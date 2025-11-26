import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
import morgan from 'morgan';
const app = express()
app.use(morgan('dev'));
express.json();
import cors from 'cors'
app.use(cors({
  origin: "https://subscription-app-tau.vercel.app/",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  credentials: true
}));

app.set('view engine', 'ejs');


app.get('/', async (req, res) => {
    res.render('index')
})


app.get('/subscribe', async (req, res) => {
    const plan = req.query.plan;

    if (!plan) {
        return res.send('Subscription plan not found');
    }

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
        line_items: [
            {
                price: priceId,
                quantity: 1
            }
        ],
        // THIS IS THE CRITICAL CHANGE: Redirect back to your Next.js app
        success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.BASE_URL}/`
    });
    
    res.redirect(session.url);
});
app.get('/success', async (req, res) => {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id, { expand: ['subscription', 'subscription.plan.product'] });
    console.log(JSON.stringify(session));

    res.send('Subscribed successfully')
})

app.get('/cancel', (req, res) => {
    res.redirect('/')
})


app.get('/customers/:customerId', async (req, res) => {
  const { customerId } = req.params;

  if (!customerId) {
    return res.status(400).json({ error: "Missing customerId" });
  }

  try {
    // Create Stripe Billing Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.BASE_URL}/`
    });

    console.log("Billing portal session created:", portalSession.id);

    // Redirect user to Stripe portal
    res.redirect(portalSession.url);

  } catch (err) {
    console.error("Stripe Billing Portal error:", err);

    // Check if customer does not exist
    if (err.type === 'StripeInvalidRequestError' && err.code === 'resource_missing') {
      // Option 1: inform user
      return res.status(404).json({ error: "Customer not found in Stripe. Please create a subscription first." });
    }

    // Other Stripe errors
    res.status(500).json({ error: "Failed to create Stripe portal session" });
  }
});

// Sucess Detail Information 

app.get("/success-details", async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product"] // minimal expand for plan/product
    });

    let customer = null;
    if (session.customer) {
      customer = await stripe.customers.retrieve(session.customer);
    }

    // Extract plan name safely
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

    console.log("Customer:", customer);
    console.log("Session:", sessionId, session);
    console.log("Plan Name:", planName);

  } catch (err) {
    console.error("Stripe Fetch Error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve session details" });
  }
});


app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET_KEY);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        //Event when the subscription started
        case 'checkout.session.completed':
            console.log('New Subscription started!')
            console.log(event.data)
            break;

        // Event when the payment is successfull (every subscription interval)  
        case 'invoice.paid':
            console.log('Invoice paid')
            console.log(event.data)
            break;

        // Event when the payment failed due to card problems or insufficient funds (every subscription interval)  
        case 'invoice.payment_failed':
            console.log('Invoice payment failed!')
            console.log(event.data)
            break;

        // Event when subscription is updated  
        case 'customer.subscription.updated':
            console.log('Subscription updated!')
            console.log(event.data)
            break

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.send();
});

app.listen(3000, () => console.log('Server started on port 3000'))
