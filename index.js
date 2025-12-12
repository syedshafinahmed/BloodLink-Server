// const express = require("express");
// const cors = require("cors");
// const app = express();
// require("dotenv").config();
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const port = process.env.PORT || 3000;
// app.use(express.json());
// app.use(cors());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@zyra.l75hwjs.mongodb.net/?appName=Zyra`;

// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   },
// });

// async function run() {
//   try {
//     // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();

//     const db = client.db("bloodlink_db");
//     const usersCollection = db.collection("users");
//     const donationRequestsCollection = db.collection("donationRequests");

//     // users API
//     app.post("/users", async (req, res) => {
//       const user = req.body;
//       const result = await usersCollection.insertOne(user);
//       res.send(result);
//     });

//     app.put("/users/:email", async (req, res) => {
//       const email = req.params.email;
//       const updatedData = req.body;
//       const result = await usersCollection.updateOne(
//         { email: email },
//         { $set: updatedData }
//       );
//       res.send(result);
//     });

//     // CREATE a donation request
//     app.post("/donation-requests", async (req, res) => {
//       const requestData = req.body;
//       requestData.createdAt = new Date();
//       requestData.donationStatus = "pending";

//       const result = await donationRequestsCollection.insertOne(requestData);
//       res.send(result);
//     });

//     // GET all donation requests
//     app.get("/donation-requests", async (req, res) => {
//       const result = await donationRequestsCollection
//         .find()
//         .sort({ createdAt: -1 })
//         .toArray();
//       res.send(result);
//     });

//     // GET donation requests by requester email
//     app.get("/donation-requests/user/:email", async (req, res) => {
//       const email = req.params.email;
//       const result = await donationRequestsCollection
//         .find({ requesterEmail: email })
//         .sort({ createdAt: -1 })
//         .toArray();
//       res.send(result);
//     });

//     // GET single donation request
//     app.get("/donation-requests/:id", async (req, res) => {
//       const id = req.params.id;
//       const result = await donationRequestsCollection.findOne({
//         _id: new ObjectId(id), // <-- Fixed ObjectId usage
//       });
//       res.send(result);
//     });

//     // UPDATE donation request
//     app.patch("/donation-requests/:id", async (req, res) => {
//       const id = req.params.id;
//       const updatedData = req.body; // <-- Allow updating all fields, not just donationStatus

//       const result = await donationRequestsCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: updatedData } // <-- Updated fields
//       );

//       res.send(result);
//     });

//     // DELETE donation request
//     app.delete("/donation-request/:id", async (req, res) => {
//       const id = req.params.id;
//       const result = await donationRequestsCollection.deleteOne({
//         _id: new ObjectId(id),
//       });
//       res.send(result);
//     });

//     // Send a ping to confirm a successful connection
//     await client.db("admin").command({ ping: 1 });
//     console.log(
//       "Pinged your deployment. You successfully connected to MongoDB!"
//     );
//   } finally {
//     // Ensures that the client will close when you finish/error
//     // await client.close();
//   }
// }
// run().catch(console.dir);

// app.get("/", (req, res) => {
//   res.send("Hehei bhaya");
// });

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}`);
// });

const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb"); // <-- added ObjectId
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@zyra.l75hwjs.mongodb.net/?appName=Zyra`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("bloodlink_db");
    const usersCollection = db.collection("users");
    const donationRequestsCollection = db.collection("donationRequests");

    // users API
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const updatedData = req.body;
      const result = await usersCollection.updateOne(
        { email: email },
        { $set: updatedData }
      );
      res.send(result);
    });

    // CREATE a donation request
    app.post("/donation-requests", async (req, res) => {
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
    app.get("/donation-requests/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await donationRequestsCollection
        .find({ requesterEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // GET single donation request
    app.get("/donation-requests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await donationRequestsCollection.findOne({
          _id: new ObjectId(id), // <-- ensure ObjectId
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
    app.patch("/donation-requests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        delete updatedData._id;

        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData } // <-- now updates all fields sent in request
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Donation request not found" });
        }

        res.send({ message: "Donation request updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Invalid ID or server error" });
      }
    });

    // DELETE donation request
    app.delete("/donation-requests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await donationRequestsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res.status(404).send({ error: "Donation request not found" });
        }
        res.send({ message: "Donation request deleted successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Invalid ID or server error" });
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
