const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pcj439l.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// Middletear function..
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorize access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('manufacturer_website').collection('tools');
        const ordersCollection = client.db('manufacturer_website').collection('orders');
        const usersCollection = client.db('manufacturer_website').collection('users');
        const reviewCollection = client.db('manufacturer_website').collection('review');
        const paymentCollection = client.db('manufacturer_website').collection('payments');
        const newsCollection = client.db('manufacturer_website').collection('news');


        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester });

            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'Forbidden access' });
            }
        }
        // Payment creation
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const service = req.body;
            const price = service.updatedPrice;
            amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        })

        // Update orders status
        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await ordersCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);
        });

        // Finding all tools of database.
        app.get('/tool', async (req, res) => {
            const query = {}
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        });

        //Finding one tool by id
        app.get('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.findOne(query);
            res.send(result);
        });

        //Insert tools 
        app.post('/tool', verifyJWT, async (req, res) => {
            const tools = req.body;
            const result = await toolsCollection.insertOne(tools);
            res.send(result);
        });
        // Deleting a Product
        app.delete('/tool/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(query);
            res.send(result);
        });

        // One order for purchase
        app.post('/order', async (req, res) => {
            const newOrder = req.body;
            const result = await ordersCollection.insertOne(newOrder);
            res.send(result);
        });

        // Updating Order information
        app.put('/order/:id', async (req, res) => {
            const id = req.params.id;

            const query = { _id: ObjectId(id) };

            const updateDoc = {
                $set: { status: 'SHIPPED' },
            };
            const result = await ordersCollection.updateOne(query, updateDoc);
            res.send(result);
        });
        // get all orders
        app.get('/orders', async (req, res) => {
            const query = {}
            const orders = await ordersCollection.find(query).toArray();
            res.send(orders);
        })

        // Find Orders
        app.get('/order', verifyJWT, async (req, res) => {
            const userEmail = req.query.userEmail;
            const decodedEmail = req.decoded.email;
            if (userEmail === decodedEmail) {
                const query = { userEmail: userEmail };
                const orders = await ordersCollection.find(query).toArray();
                res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' });
            }

        });

        // Find particular order id
        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await ordersCollection.findOne(query);
            res.send(order);
        })

        // Deleting a order
        app.delete('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(query);
            res.send(result);
        });

        // Updating Tools information
        app.put('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const updatedTool = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    quantity: updatedTool.quantity
                }
            };
            const result = await toolsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // Get one user
        app.get('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);

            res.send(user);
        });

        // Make User or existing user
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };

            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);

            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ result, acccessToken: token });
        });


        // Finding all Users.
        app.get('/user', verifyJWT, async (req, res) => {
            const query = {}
            const cursor = usersCollection.find(query);
            const users = await cursor.toArray();
            res.send(users);
        });

        // Get admin login status
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        // Set admin role
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;

            const filter = { email: email };

            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // Finding all reviews of database.
        app.get('/review', async (req, res) => {
            const query = {}
            const cursor = reviewCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        // Review of users
        app.post('/review', async (req, res) => {
            const review = req.body;
            // const email = req.query.email;
            const query = { email: review.email }
            const exists = await reviewCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, review: exists });
            }
            const result = await reviewCollection.insertOne(review);
            return res.send({ success: true, result });
        });

        // Finding all latest news of database.
        app.get('/news', async (req, res) => {
            const query = {}
            const cursor = newsCollection.find(query);
            const news = await cursor.toArray();
            res.send(news);
        });
    }
    finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Running for Manufecturer website')
})

app.listen(port, () => {
    console.log(`Manufecturer website is listening on port ${port}`)
})