const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceKey.json");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@zyra.l75hwjs.mongodb.net/?appName=Zyra`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).send({ error: "Unauthorized access" });
    }

    const token = authHeader.split(" ")[1];
    const decodedUser = await admin.auth().verifyIdToken(token);

    req.user = decodedUser;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).send({ error: "Unauthorized access" });
  }
};

async function run() {
  try {
    await client.connect();

    const db = client.db("bloodlink_db");
    const usersCollection = db.collection("users");
    const donationRequestsCollection = db.collection("donationRequests");
    const fundingsCollection = db.collection("fundings");

    // users API
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const updatedData = req.body;
      await usersCollection.updateOne({ email }, { $set: updatedData });
      const updatedUser = await usersCollection.findOne({ email });
      res.send(updatedUser);
    });

    // GET users with (email, bloodGroup, district, upazila)
    app.get("/users", verifyFirebaseToken, async (req, res) => {
      try {
        const { email, bloodGroup, district, upazila } = req.query;
        const query = {};
        if (email) query.email = email;
        if (bloodGroup) query.bloodGroup = bloodGroup;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;

        const users = await usersCollection.find(query).toArray();
        res.send(users);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch users" });
      }
    });

    // CREATE a donation request
    app.post("/donation-requests", verifyFirebaseToken, async (req, res) => {
      const requestData = req.body;
      requestData.createdAt = new Date();
      requestData.donationStatus = "pending";

      const result = await donationRequestsCollection.insertOne(requestData);
      res.send(result);
    });

    // GET all donation requests
    app.get("/donation-requests", async (req, res) => {
      const result = await donationRequestsCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // GET donation requests by requester email
    app.get(
      "/donation-requests/user/:email",
      verifyFirebaseToken,
      async (req, res) => {
        const email = req.params.email;
        const result = await donationRequestsCollection
          .find({ requesterEmail: email })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      }
    );

    // GET single donation request
    app.get("/donation-requests/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await donationRequestsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!result) {
          return res.status(404).send({ error: "Donation request not found" });
        }
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Invalid ID or server error" });
      }
    });

    // UPDATE donation request
    app.patch(
      "/donation-requests/:id",
      verifyFirebaseToken,
      async (req, res) => {
        try {
          const id = req.params.id;
          const updatedData = req.body;
          delete updatedData._id;

          const result = await donationRequestsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedData }
          );

          if (result.matchedCount === 0) {
            return res
              .status(404)
              .send({ error: "Donation request not found" });
          }

          res.send({ message: "Donation request updated successfully" });
        } catch (error) {
          console.error(error);
          res.status(500).send({ error: "Invalid ID or server error" });
        }
      }
    );

    // DELETE donation request
    app.delete(
      "/donation-requests/:id",
      verifyFirebaseToken,
      async (req, res) => {
        try {
          const id = req.params.id;
          const result = await donationRequestsCollection.deleteOne({
            _id: new ObjectId(id),
          });
          if (result.deletedCount === 0) {
            return res
              .status(404)
              .send({ error: "Donation request not found" });
          }
          res.send({ message: "Donation request deleted successfully" });
        } catch (error) {
          console.error(error);
          res.status(500).send({ error: "Invalid ID or server error" });
        }
      }
    );

    // GET donation requests by status
    app.get(
      "/donation-requests/status/:status",
      verifyFirebaseToken,
      async (req, res) => {
        try {
          const status = req.params.status.toLowerCase();

          const allowedStatuses = ["pending", "inprogress", "done", "canceled"];
          let query = {};

          if (status !== "all" && allowedStatuses.includes(status)) {
            query.donationStatus = status;
          }

          const result = await donationRequestsCollection
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

          res.send(result);
        } catch (err) {
          console.error(err);
          res.status(500).send({ error: "Failed to fetch donation requests" });
        }
      }
    );

    // STRIPE
    app.post("/create-payment-intent", async (req, res) => {
      const { amount, userEmail, userName } = req.body;

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "bdt",
                product_data: { name: "Donation Fund" },
                unit_amount: amount * 100,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${
            process.env.SITE_DOMAIN
          }/fundings-success?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(
            userEmail
          )}&name=${encodeURIComponent(userName)}&amount=${amount}`,
          cancel_url: `${process.env.SITE_DOMAIN}/fundings-cancel`,
        });

        await fundingsCollection.insertOne({
          userName,
          userEmail,
          amount,
          createdAt: new Date(),
          stripeSessionId: session.id,
          paid: false,
        });

        res.send({ url: session.url });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to create payment session" });
      }
    });

    // GET all fundings
    app.get("/fundings", async (req, res) => {
      try {
        const fundings = await fundingsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(fundings);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to fetch fundings" });
      }
    });

    // Add new funding record
    app.post("/fundings", verifyFirebaseToken, async (req, res) => {
      try {
        const funding = { ...req.body, createdAt: new Date() };
        const result = await fundingsCollection.insertOne(funding);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to add funding" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hehei bhaya");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
