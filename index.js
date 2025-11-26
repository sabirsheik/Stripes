// import express from 'express';
// import Stripe from 'stripe';
// import dotenv from 'dotenv';
// dotenv.config();
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// import morgan from 'morgan';
// const app = express()
// app.use(morgan('dev'));
// express.json();
// import cors from 'cors'
// app.use(cors({
//   origin: "https://subscription-app-tau.vercel.app",
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
//   credentials: true
// }));

// app.set('view engine', 'ejs');


// app.get('/', async (req, res) => {
//     res.render('index')
// })


// app.get('/subscribe', async (req, res) => {
//     const plan = req.query.plan;

//     if (!plan) {
//         return res.send('Subscription plan not found');
//     }

//     let priceId;
//     switch (plan.toLowerCase()) {
//         case 'pro':
//             priceId = 'price_1SXpMYGWk6mC23QiMHiS2BUV';
//             break;
//         default:
//             return res.send('Subscription plan not found');
//     }

//     const session = await stripe.checkout.sessions.create({
//         mode: 'subscription',
//         line_items: [
//             {
//                 price: priceId,
//                 quantity: 1
//             }
//         ],
//         // THIS IS THE CRITICAL CHANGE: Redirect back to your Next.js app
//         success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
//         cancel_url: `${process.env.BASE_URL}/`
//     });
    
//     res.redirect(session.url);
// });
// app.get('/success', async (req, res) => {
//     const session = await stripe.checkout.sessions.retrieve(req.query.session_id, { expand: ['subscription', 'subscription.plan.product'] });
//     console.log(JSON.stringify(session));

//     res.send('Subscribed successfully')
// })

// app.get('/cancel', (req, res) => {
//     res.redirect('/')
// })


// app.get('/customers/:customerId', async (req, res) => {
//   const { customerId } = req.params;

//   if (!customerId) {
//     return res.status(400).json({ error: "Missing customerId" });
//   }

//   try {
//     // Create Stripe Billing Portal session
//     const portalSession = await stripe.billingPortal.sessions.create({
//       customer: customerId,
//       return_url: `${process.env.BASE_URL}/`
//     });

//     console.log("Billing portal session created:", portalSession.id);

//     // Redirect user to Stripe portal
//     res.redirect(portalSession.url);

//   } catch (err) {
//     console.error("Stripe Billing Portal error:", err);

//     // Check if customer does not exist
//     if (err.type === 'StripeInvalidRequestError' && err.code === 'resource_missing') {
//       // Option 1: inform user
//       return res.status(404).json({ error: "Customer not found in Stripe. Please create a subscription first." });
//     }

//     // Other Stripe errors
//     res.status(500).json({ error: "Failed to create Stripe portal session" });
//   }
// });

// // Sucess Detail Information 

// app.get("/success-details", async (req, res) => {
//   try {
//     const sessionId = req.query.session_id;

//     if (!sessionId) {
//       return res.status(400).json({ error: "Missing session_id" });
//     }

//     const session = await stripe.checkout.sessions.retrieve(sessionId, {
//       expand: ["line_items.data.price.product"] // minimal expand for plan/product
//     });

//     let customer = null;
//     if (session.customer) {
//       customer = await stripe.customers.retrieve(session.customer);
//     }

//     // Extract plan name safely
//     const planName =
//       session.line_items?.data[0]?.price?.product?.name ||
//       session.subscription?.items?.data[0]?.price?.product?.name ||
//       "Unknown Plan";

//     res.status(200).json({
//       success: true,
//       session,
//       customer,
//       planName
//     });

//     console.log("Customer:", customer);
//     console.log("Session:", sessionId, session);
//     console.log("Plan Name:", planName);

//   } catch (err) {
//     console.error("Stripe Fetch Error:", err.message);
//     return res.status(500).json({ error: "Failed to retrieve session details" });
//   }
// });


// app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
//     const sig = req.headers['stripe-signature'];

//     let event;

//     try {
//         event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET_KEY);
//     } catch (err) {
//         return res.status(400).send(`Webhook Error: ${err.message}`);
//     }

//     // Handle the event
//     switch (event.type) {
//         //Event when the subscription started
//         case 'checkout.session.completed':
//             console.log('New Subscription started!')
//             console.log(event.data)
//             break;

//         // Event when the payment is successfull (every subscription interval)  
//         case 'invoice.paid':
//             console.log('Invoice paid')
//             console.log(event.data)
//             break;

//         // Event when the payment failed due to card problems or insufficient funds (every subscription interval)  
//         case 'invoice.payment_failed':
//             console.log('Invoice payment failed!')
//             console.log(event.data)
//             break;

//         // Event when subscription is updated  
//         case 'customer.subscription.updated':
//             console.log('Subscription updated!')
//             console.log(event.data)
//             break

//         default:
//             console.log(`Unhandled event type ${event.type}`);
//     }

//     res.send();
// });

// app.listen(3000, () => console.log('Server started on port 3000'))


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

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.sendStatus(200);
});


// START SERVER
app.listen(3000, () => console.log('Server started on port 3000'));
