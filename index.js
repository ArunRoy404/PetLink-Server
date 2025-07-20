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



        const verifyFirebase = async (req, res, next) => {
            const authorization = req?.headers?.authorization
            const firebaseToken = authorization

            if (!firebaseToken) {
                res.status(401).send({ message: "Unauthorized Access" })
            }
            try {
                const tokenUser = await admin.auth().verifyIdToken(firebaseToken)
                req.tokenUser = tokenUser
                next()
            } catch (error) {
                res.status(401).send({ message: "Invalid Token", error })
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