const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pcj439l.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('manufacturer_website').collection('tools');
        const ordersCollection = client.db('manufacturer_website').collection('orders');

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

        // One order for purchase
        app.post('/order', async (req, res) => {
            const newOrder = req.body;
            const result = await ordersCollection.insertOne(newOrder);
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