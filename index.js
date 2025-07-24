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


const decoded = Buffer.from(FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded)


var admin = require("firebase-admin");
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
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })




        app.post('/pets', async (req, res) => {
            const petData = req.body
            petData.adopted = false
            petData.addTime = new Date().toLocaleString()

            const result = await petsCollection.insertOne(petData)
            res.send(result)
        })


        app.get('/pets-count', verifyFirebase, async (req, res) => {
            const result = await petsCollection.countDocuments()
            res.send(result)
        })

        app.get('/pets', async (req, res) => {
            const result = await petsCollection.find().toArray()
            res.send(result)
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

            const result = await petsCollection.find(query)
                .skip(page * size)
                .limit(size)
                .toArray()
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