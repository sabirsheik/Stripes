import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

import morgan from 'morgan';
import cors from 'cors';

const app = express();

app.use(morgan('dev'));
app.use(cors({
  origin: "https://subscription-app-tau.vercel.app",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  credentials: true
}));

// IMPORTANT: Needed for all non-webhook routes
app.use(express.json());

app.set('view engine', 'ejs');


// ---------------------------------------------
// ROUTES
// ---------------------------------------------

app.get('/', async (req, res) => {
  res.render('index');
});


// 🔥 CREATE A SUBSCRIPTION CHECKOUT
app.get('/subscribe', async (req, res) => {
  const plan = req.query.plan;

  if (!plan) return res.send('Subscription plan not found');

  let priceId;
  switch (plan.toLowerCase()) {
    case 'pro':
      priceId = 'price_1SXpMYGWk6mC23QiMHiS2BUV';
      break;
    default:
      return res.send('Subscription plan not found');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],

    // 🚀 You MUST add userId reference here when integrating frontend login/session
    // client_reference_id: "USER_FIREBASE_ID",
    // metadata: { userId: "USER_FIREBASE_ID" },

    success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/`
  });

  res.redirect(session.url);
});


// SUCCESS ROUTE
app.get('/success', async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(
    req.query.session_id,
    { expand: ['subscription', 'subscription.plan.product'] }
  );

  console.log(JSON.stringify(session));
  res.send('Subscribed successfully');
});


// CANCEL ROUTE
app.get('/cancel', (req, res) => {
  res.redirect('/');
});


// 🔥 BILLING PORTAL
app.get('/customers/:customerId', async (req, res) => {
  const { customerId } = req.params;

  if (!customerId) return res.status(400).json({ error: "Missing customerId" });

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.BASE_URL}/`
    });

    res.redirect(portalSession.url);

  } catch (err) {
    console.error("Stripe Billing Portal error:", err);

    if (err.type === 'StripeInvalidRequestError' && err.code === 'resource_missing') {
      return res.status(404).json({ error: "Customer not found in Stripe. Please create a subscription first." });
    }

    res.status(500).json({ error: "Failed to create Stripe portal session" });
  }
});


// 🔥 SUCCESS DETAILS
app.get("/success-details", async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product"]
    });

    let customer = null;
    if (session.customer) {
      customer = await stripe.customers.retrieve(session.customer);
    }

    const planName =
      session.line_items?.data[0]?.price?.product?.name ||
      session.subscription?.items?.data[0]?.price?.product?.name ||
      "Unknown Plan";

    res.status(200).json({
      success: true,
      session,
      customer,
      planName
    });

  } catch (err) {
    console.error("Stripe Fetch Error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve session details" });
  }
});


// -------------------------------------------------------
// 🔥🔥🔥 WEBHOOK — FULLY UPDATED FOR CANCEL HANDLING! 🔥🔥🔥
// -------------------------------------------------------

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET_KEY);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {

    // ---------------------------------------------------
    // WHEN USER BUYS A SUBSCRIPTION
    // ---------------------------------------------------
    case 'checkout.session.completed': {
      const data = event.data.object;
      console.log("Subscription started:", data);

      // ⚠️ HERE you save subscription info to DB
      // const userId = data.client_reference_id || data.metadata?.userId;
      break;
    }

    // ---------------------------------------------------
    // WHEN USER PAYMENT SUCCEEDS
    // ---------------------------------------------------
    case 'invoice.paid': {
      console.log("Invoice paid:", event.data.object);
      break;
    }

    // ---------------------------------------------------
    // WHEN PAYMENT FAILS
    // ---------------------------------------------------
    case 'invoice.payment_failed': {
      console.log("Payment failed:", event.data.object);
      break;
    }

    // ---------------------------------------------------
    // 🔥 MOST IMPORTANT: WHEN SUBSCRIPTION IS UPDATED
    // THIS INCLUDES: Cancellation, pause, resume, plan change
    // ---------------------------------------------------
    case 'customer.subscription.updated': {
      const subscription = event.data.object;

      console.log("SUBSCRIPTION UPDATED ----------");
      console.log(subscription);

      // GET Stripe customer ID
      const stripeCustomerId = subscription.customer;

      // GET USER ID (IF STORED IN METADATA)
      const userId = subscription.metadata?.userId;

      // TODO: Save these values in Firestore / MongoDB:
      const subscriptionData = {
        status: subscription.status.toUpperCase(),
        plan_id: subscription.items.data[0].price.id,
        period_end: new Date(subscription.current_period_end * 1000),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updatedAt: new Date()
      };

      console.log("SAVE TO DATABASE:", subscriptionData);

      // Example MongoDB:
      // await User.updateOne({ stripeCustomerId }, subscriptionData);

      break;
    }
          // Add this case to your webhook switch statement
case 'customer.subscription.deleted':
    const deletedSubscription = event.data.object;
    // We need to find the user associated with this subscription
    // If you saved stripeCustomerId on the user, you can query by that.
    // Or if you passed userId in metadata, use that.
    
    // Example: Query users by stripeCustomerId
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('stripeCustomerId', '==', deletedSubscription.customer).get();

    if (!snapshot.empty) {
        snapshot.forEach(async (doc) => {
            await doc.ref.update({
                plan: 'free',
                status: 'CANCELLED', // Use a distinct status for history, or just 'ACTIVE' if you want them "Active on Free"
                plan_id: null,
                period_end: null,
                cancel_at_period_end: false,
                updatedAt: new Date()
            });
            console.log(`User ${doc.id} downgraded to Free.`);
        });
    }
    break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.sendStatus(200);
});


// START SERVER
app.listen(3000, () => console.log('Server started on port 3000'));
