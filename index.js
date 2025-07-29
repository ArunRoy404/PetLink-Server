require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const app = express()
const port = process.env.PORT || 3000
app.use(cors());
app.use(express.json())

const DB_USER = process.env.DB_USER
const DB_PASS = process.env.DB_PASS
const FB_SERVICE_KEY = process.env.FB_SERVICE_KEY
const STRIPE_KEY = process.env.PAYMENT_GATEWAY_KEY

const stripe = require('stripe')(STRIPE_KEY)


const decoded = Buffer.from(FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded)


var admin = require("firebase-admin");
const { default: Stripe } = require('stripe');
// var serviceAccount = require("./firebase-admin-service-key.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const uri = `mongodb+srv://${DB_USER}:${DB_PASS}@roy.tqtwhk6.mongodb.net/?retryWrites=true&w=majority&appName=ROY`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});


async function run() {
    try {
        // await client.connect()
        const database = client.db('PetLink')
        const usersCollection = database.collection('users')
        const petsCollection = database.collection('pets')
        const campaignsCollection = database.collection('campaigns')
        const adoptionCollection = database.collection('adoptions')
        const donationsCollections = database.collection('donations')



        const verifyFirebase = async (req, res, next) => {
            const authorization = req?.headers?.authorization
            const firebaseToken = authorization

            if (!firebaseToken) {
                return res.status(401).send({ message: "Unauthorized Access" })
            }

            try {
                const tokenUser = await admin.auth().verifyIdToken(firebaseToken)
                req.tokenUser = tokenUser
                next()
            } catch (error) {
                return res.status(401).send({ message: "Invalid Token", error })
            }
        }





        app.get('/users-count', async (req, res) => {
            const result = await usersCollection.estimatedDocumentCount()
            res.send(result)
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            const result = await usersCollection.findOne({ email })
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body
            const userExist = await usersCollection.findOne({ email: user?.email })

            if (userExist) {
                return res.status(200).send({ message: "User already exists" })
            }

            user.role = 'user'
            user.banned = false
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        app.put('/users', verifyFirebase, async (req, res) => {
            const { _id, ...userData } = req.body.data.userData
            const query = { _id: new ObjectId(_id) }
            const update = { $set: userData }
            const option = { upsert: true }

            const result = await usersCollection.updateOne(query, update, option)
            res.send(result)
        })


        app.get('/users', verifyFirebase, async (req, res) => {
            const page = parseInt(req.query.page)
            const size = parseInt(req.query.size)

            const result = await usersCollection
                .find()
                .skip(page * size)
                .limit(size)
                .toArray()
            res.send(result)
        })






        app.post('/pets', async (req, res) => {
            const petData = req.body
            petData.addTime = new Date().toISOString()
            petData.adopted = false

            const result = await petsCollection.insertOne(petData)
            res.send(result)
        })


        app.get('/pets-count', async (req, res) => {
            const result = await petsCollection.countDocuments()
            res.send(result)
        })


        app.get('/pets', async (req, res) => {
            try {
                const page = parseInt(req.query.page)
                const size = parseInt(req.query.size)
                const searchTerm = req.query.search
                const category = req.query.category
                const sortBy = { addTime: -1 }

                // Build query dynamically
                const query = {}

                if (searchTerm) {
                    query.petName = { $regex: searchTerm, $options: 'i' }
                }

                if (category) {
                    query.petCategory = category
                }


                const result = await petsCollection.find(query)
                    .sort(sortBy)
                    .skip(page * size)
                    .limit(size)
                    .toArray()

                console.log(result);

                res.send(result)


                // // Get total count and paginated results in parallel
                // const [total, results] = await Promise.all([
                //     petsCollection.countDocuments(query),
                //     petsCollection.find(query)
                //         .sort({ addTime: -1 })
                //         .skip(page * size)
                //         .limit(size)
                //         .toArray()
                // ])

                // res.send({
                //     total,
                //     results,
                //     page,
                //     size,
                //     totalPages: Math.ceil(total / size)
                // })
            } catch (error) {
                console.error('Error fetching pets:', error)
                res.status(500).send({
                    error: 'Failed to fetch pets',
                    details: error.message
                })
            }
        })


        // Get all unique pet categories
        app.get('/pet-categories', async (req, res) => {
            try {
                const categories = await petsCollection.aggregate([
                    { $group: { _id: "$petCategory" } },
                    { $sort: { _id: 1 } }
                ]).toArray()

                const categoryList = categories.map(cat => cat._id)

                res.send(categoryList)
            } catch (error) {
                console.error('Error fetching pet categories:', error)
                res.status(500).send({ error: 'Failed to fetch pet categories' })
            }
        })

        app.get('/pet/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await petsCollection.findOne(query)
            res.send(result)
        })

        app.delete('/pets', verifyFirebase, async (req, res) => {
            const addedBy = req.tokenUser.email
            const petId = req.body.petId
            const query = { _id: new ObjectId(petId), addedBy }
            const result = await petsCollection.deleteOne(query)
            res.send(result)
        })
        app.put('/pets', verifyFirebase, async (req, res) => {
            const addedBy = req.tokenUser.email
            const { _id, ...petData } = req.body.data.petData
            const query = { _id: new ObjectId(_id), addedBy }
            const update = { $set: petData }
            const option = { upsert: true }

            const result = await petsCollection.updateOne(query, update, option)
            res.send(result)
        })

        app.get('/my-added-pets-count', verifyFirebase, async (req, res) => {
            const email = req.tokenUser.email
            const query = { addedBy: email }
            const result = await petsCollection.countDocuments(query)
            res.send(result)
        })
        app.get('/my-added-pets', verifyFirebase, async (req, res) => {
            const page = parseInt(req.query.page)
            const size = parseInt(req.query.size)

            const email = req.tokenUser.email
            const query = { addedBy: email }
            const sortBy = { 'addTime': -1 }

            const result = await petsCollection.find(query).sort(sortBy)
                .skip(page * size)
                .limit(size)
                .toArray()
            res.send(result)
        })






        app.get('/campaigns', async (req, res) => {
            const page = parseInt(req.query.page)
            const size = parseInt(req.query.size)
            const paused = req.query.paused


            const query = {}
            if(paused !== 'undefined'){
                query.paused = paused === 'true'
            }

            const sortBy = { 'createdAt': -1 }


            const result = await campaignsCollection.find(query).sort(sortBy)
                .skip(page * size)
                .limit(size)
                .toArray()
            res.send(result)
        })

        app.get('/campaign/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await campaignsCollection.findOne(query)
            res.send(result)
        })


        app.post('/campaigns', verifyFirebase, async (req, res) => {
            const petData = req.body
            petData.paused = false

            const result = await campaignsCollection.insertOne(petData)
            res.send(result)
        })

        app.get('/campaigns-count', async (req, res) => {
            const result = await campaignsCollection.countDocuments()
            res.send(result)
        })
        app.get('/my-campaigns-count', verifyFirebase, async (req, res) => {
            const email = req.tokenUser.email
            const query = { addedBy: email }
            const result = await campaignsCollection.countDocuments(query)
            res.send(result)
        })

        app.get('/my-campaigns', verifyFirebase, async (req, res) => {
            const page = parseInt(req.query.page)
            const size = parseInt(req.query.size)

            const email = req.tokenUser.email
            const query = { addedBy: email }

            const sortBy = { 'createdAt': -1 }


            const result = await campaignsCollection.find(query).sort(sortBy)
                .skip(page * size)
                .limit(size)
                .toArray()
            res.send(result)
        })

        app.put('/campaigns', verifyFirebase, async (req, res) => {
            const addedBy = req.tokenUser.email
            const { _id, ...campaignData } = req.body.data.campaignData
            const query = { _id: new ObjectId(_id), addedBy }
            const update = { $set: campaignData }
            const option = { upsert: true }

            const result = await campaignsCollection.updateOne(query, update, option)
            res.send(result)
        })









        app.post('/adoptions', async (req, res) => {
            const adoptionData = req.body
            const result = adoptionCollection.insertOne(adoptionData)
            res.send(result)
        })












        app.post('/create-payment-intent', async (req, res) => {
            const amountInCents = req.body.amountInCents
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountInCents,
                    currency: 'usd',
                    payment_method_types: ['card'],
                });
                res.json({ clientSecret: paymentIntent.client_secret })
            } catch (error) {
                console.log(error.message);
                res.status(500).json({ error: error.message })
            }
        })

        app.post('/donations', async(req, res)=>{
            const donationData = req.body
            const result = await donationsCollections.insertOne(donationData)
            res.send(result)
        })

        app.get('/donations', async(req, res)=>{
            const sortBy = {'createdAt': -1}
            const result = await donationsCollections.find().sort(sortBy).toArray()
            res.send(result)
        })




        // await client.db('admin').command({ ping: 1 })
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send("PetLink Server Running!")
})

app.listen(port, () => {
    console.log(`app is listening on port: ${port}`)
})