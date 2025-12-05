// import express from 'express';
// import Stripe from 'stripe';
// import dotenv from 'dotenv';
// dotenv.config();

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// import morgan from 'morgan';
// import cors from 'cors';

// const app = express();

// app.use(morgan('dev'));
// app.use(cors({
//   origin: "https://subscription-app-tau.vercel.app",
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
//   credentials: true
// }));

// // IMPORTANT: Needed for all non-webhook routes
// app.use(express.json());

// app.set('view engine', 'ejs');


// // ---------------------------------------------
// // ROUTES
// // ---------------------------------------------

// app.get('/', async (req, res) => {
//   res.render('index');
// });


// // 🔥 CREATE A SUBSCRIPTION CHECKOUT
// app.get('/subscribe', async (req, res) => {
//   const plan = req.query.plan;

//   if (!plan) return res.send('Subscription plan not found');

//   let priceId;
//   switch (plan.toLowerCase()) {
//     case 'pro':
//       priceId = 'price_1SXpMYGWk6mC23QiMHiS2BUV';
//       break;
//     default:
//       return res.send('Subscription plan not found');
//   }

//   const session = await stripe.checkout.sessions.create({
//     mode: 'subscription',
//     line_items: [{ price: priceId, quantity: 1 }],

//     // 🚀 You MUST add userId reference here when integrating frontend login/session
//     // client_reference_id: "USER_FIREBASE_ID",
//     // metadata: { userId: "USER_FIREBASE_ID" },

//     success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${process.env.BASE_URL}/`
//   });

//   res.redirect(session.url);
// });


// // SUCCESS ROUTE
// app.get('/success', async (req, res) => {
//   const session = await stripe.checkout.sessions.retrieve(
//     req.query.session_id,
//     { expand: ['subscription', 'subscription.plan.product'] }
//   );

//   console.log(JSON.stringify(session));
//   res.send('Subscribed successfully');
// });


// // CANCEL ROUTE
// app.get('/cancel', (req, res) => {
//   res.redirect('/');
// });


// // 🔥 BILLING PORTAL
// app.get('/customers/:customerId', async (req, res) => {
//   const { customerId } = req.params;

//   if (!customerId) return res.status(400).json({ error: "Missing customerId" });

//   try {
//     const portalSession = await stripe.billingPortal.sessions.create({
//       customer: customerId,
//       return_url: `${process.env.BASE_URL}/`
//     });

//     res.redirect(portalSession.url);

//   } catch (err) {
//     console.error("Stripe Billing Portal error:", err);

//     if (err.type === 'StripeInvalidRequestError' && err.code === 'resource_missing') {
//       return res.status(404).json({ error: "Customer not found in Stripe. Please create a subscription first." });
//     }

//     res.status(500).json({ error: "Failed to create Stripe portal session" });
//   }
// });


// // 🔥 SUCCESS DETAILS
// app.get("/success-details", async (req, res) => {
//   try {
//     const sessionId = req.query.session_id;

//     if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

//     const session = await stripe.checkout.sessions.retrieve(sessionId, {
//       expand: ["line_items.data.price.product"]
//     });

//     let customer = null;
//     if (session.customer) {
//       customer = await stripe.customers.retrieve(session.customer);
//     }

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

//   } catch (err) {
//     console.error("Stripe Fetch Error:", err.message);
//     return res.status(500).json({ error: "Failed to retrieve session details" });
//   }
// });


// // -------------------------------------------------------
// // 🔥🔥🔥 WEBHOOK — FULLY UPDATED FOR CANCEL HANDLING! 🔥🔥🔥
// // -------------------------------------------------------

// app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
//   const sig = req.headers['stripe-signature'];

//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET_KEY);
//   } catch (err) {
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   switch (event.type) {

//     // ---------------------------------------------------
//     // WHEN USER BUYS A SUBSCRIPTION
//     // ---------------------------------------------------
//     case 'checkout.session.completed': {
//       const data = event.data.object;
//       console.log("Subscription started:", data);

//       // ⚠️ HERE you save subscription info to DB
//       // const userId = data.client_reference_id || data.metadata?.userId;
//       break;
//     }

//     // ---------------------------------------------------
//     // WHEN USER PAYMENT SUCCEEDS
//     // ---------------------------------------------------
//     case 'invoice.paid': {
//       console.log("Invoice paid:", event.data.object);
//       break;
//     }

//     // ---------------------------------------------------
//     // WHEN PAYMENT FAILS
//     // ---------------------------------------------------
//     case 'invoice.payment_failed': {
//       console.log("Payment failed:", event.data.object);
//       break;
//     }

//     // ---------------------------------------------------
//     // 🔥 MOST IMPORTANT: WHEN SUBSCRIPTION IS UPDATED
//     // THIS INCLUDES: Cancellation, pause, resume, plan change
//     // ---------------------------------------------------
//     case 'customer.subscription.updated': {
//       const subscription = event.data.object;

//       console.log("SUBSCRIPTION UPDATED ----------");
//       console.log(subscription);

//       // GET Stripe customer ID
//       const stripeCustomerId = subscription.customer;

//       // GET USER ID (IF STORED IN METADATA)
//       const userId = subscription.metadata?.userId;

//       // TODO: Save these values in Firestore / MongoDB:
//       const subscriptionData = {
//         status: subscription.status.toUpperCase(),
//         plan_id: subscription.items.data[0].price.id,
//         period_end: new Date(subscription.current_period_end * 1000),
//         cancel_at_period_end: subscription.cancel_at_period_end,
//         updatedAt: new Date()
//       };

//       console.log("SAVE TO DATABASE:", subscriptionData);

//       // Example MongoDB:
//       // await User.updateOne({ stripeCustomerId }, subscriptionData);

//       break;
//     }
//           // Add this case to your webhook switch statement
// case 'customer.subscription.deleted':
//     const deletedSubscription = event.data.object;
//     // We need to find the user associated with this subscription
//     // If you saved stripeCustomerId on the user, you can query by that.
//     // Or if you passed userId in metadata, use that.
    
//     // Example: Query users by stripeCustomerId
//     const usersRef = db.collection('users');
//     const snapshot = await usersRef.where('stripeCustomerId', '==', deletedSubscription.customer).get();

//     if (!snapshot.empty) {
//         snapshot.forEach(async (doc) => {
//             await doc.ref.update({
//                 plan: 'free',
//                 status: 'CANCELLED', // Use a distinct status for history, or just 'ACTIVE' if you want them "Active on Free"
//                 plan_id: null,
//                 period_end: null,
//                 cancel_at_period_end: false,
//                 updatedAt: new Date()
//             });
//             console.log(`User ${doc.id} downgraded to Free.`);
//         });
//     }
//     break;

//     default:
//       console.log(`Unhandled event type: ${event.type}`);
//   }

//   res.sendStatus(200);
// });


// // START SERVER
// app.listen(3000, () => console.log('Server started on port 3000'));

import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
// Note: We use the client SDK here for simplicity as requested, 
// but ensure you have firebase credentials configured if running locally.
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";

dotenv.config();

// Initialize Firebase (Client SDK) to update DB from Webhook
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBthJ5c-xhUBeHqdpIMTNst4xKW6hb71-g",
  authDomain: "tesiting-786.firebaseapp.com",
  projectId: "tesiting-786",
  storageBucket: "tesiting-786.firebasestorage.app",
  messagingSenderId: "1060809722527",
  appId: "1:1060809722527:web:d40777b2f9f87043ff70aa",
  measurementId: "G-ZWLMHVVJDF"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(morgan('dev'));
app.use(cors({
  origin: "https://subscription-app-tau.vercel.app",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  credentials: true
}));

// Use JSON for everything except webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.get('/', (req, res) => res.send('Backend Active'));

app.get('/subscribe', async (req, res) => {
  const { plan, userId } = req.query;
  if (!plan) return res.send('Plan not found');

  // Hardcoded for 'pro'
  const priceId = 'price_1SXpMYGWk6mC23QiMHiS2BUV'; 

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // CRITICAL: Pass userId so Webhook knows who bought it
      client_reference_id: userId, 
      metadata: { userId }, 
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/`
    });
    res.redirect(session.url);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/success-details', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: "No session_id" });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ['subscription', 'line_items']
    });
    res.json({ success: true, session, customer: session.customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/customers/:customerId', async (req, res) => {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: req.params.customerId,
      return_url: `${process.env.BASE_URL}/`
    });
    res.redirect(session.url);
  } catch (err) {
    res.status(500).send("Portal Error");
  }
});

// --- WEBHOOK ---
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET_KEY);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.userId;
      if (userId) {
         // Update DB to PRO immediately
         await updateDoc(doc(db, 'users', userId), {
            plan: 'pro',
            status: 'ACTIVE',
            stripeCustomerId: session.customer,
            plan_id: typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
            updatedAt: new Date()
         });
      }
    } 
    else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      // Find user by stripeCustomerId to update cancel status
      const q = query(collection(db, 'users'), where('stripeCustomerId', '==', sub.customer));
      const snapshot = await getDocs(q);
      snapshot.forEach(async (d) => {
         await updateDoc(d.ref, {
            status: sub.status.toUpperCase(),
            cancel_at_period_end: sub.cancel_at_period_end,
            period_end: new Date(sub.current_period_end * 1000),
            updatedAt: new Date()
         });
      });
    }
    else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const q = query(collection(db, 'users'), where('stripeCustomerId', '==', sub.customer));
      const snapshot = await getDocs(q);
      snapshot.forEach(async (d) => {
         await updateDoc(d.ref, {
            plan: 'free',
            status: 'CANCELLED',
            plan_id: null,
            period_end: null,
            cancel_at_period_end: false,
            updatedAt: new Date()
         });
      });
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
  }

  res.send({ received: true });
});

app.listen(3000, () => console.log('Server running on 3000'));
