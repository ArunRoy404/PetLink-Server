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
        const adoptionsCollection = database.collection('adoptions')
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

        const verifyAdmin = async (req, res, next) => {
            try {
                const email = req.tokenUser.email
                const { role } = await usersCollection.findOne({ email })
                if (role === 'admin') {
                    next()
                } else {
                    return res.status(401).send({ message: "Unauthorized Access" })
                }
            }
            catch (error) {
                return res.status(401).send({ message: "Unauthorized Access" })
            }
        }



        app.get('/users-count', verifyFirebase, verifyAdmin, async (req, res) => {
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

        app.put('/users', verifyFirebase, verifyAdmin, async (req, res) => {
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






        app.post('/pets', verifyFirebase, async (req, res) => {
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
                const adopted = req.query.adopted
                const sortBy = { addTime: -1 }


                // Build query dynamically
                const query = {}

                if (searchTerm) {
                    query.petName = { $regex: searchTerm, $options: 'i' }
                }

                if (category) {
                    query.petCategory = category
                }

                if (typeof adopted !== undefined && adopted !== 'undefined') {
                    query.adopted = adopted === 'true'
                }

                const result = await petsCollection.find(query)
                    .sort(sortBy)
                    .skip(page * size)
                    .limit(size)
                    .toArray()

                res.send(result)


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

        app.delete('/pets',verifyFirebase, async (req, res) => {
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






        app.get('/all-campaigns', async (req, res) => {
            const sortBy = { createdAt: -1 };

            try {
                const campaignsWithDonations = await campaignsCollection.aggregate([
                    { $sort: sortBy },
                    {
                        // Convert _id ObjectId to string to match with campaignId in donations
                        $addFields: {
                            _idStr: { $toString: '$_id' }
                        }
                    },
                    {
                        $lookup: {
                            from: 'donations',
                            let: { campaignId: '$_idStr' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $eq: ['$campaignId', '$$campaignId'] }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 0,
                                        amount: 1,
                                        donorName: 1,
                                        createdAt: 1
                                    }
                                },
                                { $sort: { createdAt: -1 } }
                            ],
                            as: 'donations'
                        }
                    },
                    // Optionally remove the _idStr field from output
                    {
                        $project: {
                            _idStr: 0
                        }
                    }
                ]).toArray();

                res.send(campaignsWithDonations);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to fetch campaigns with donations' });
            }
        })

        app.get('/campaigns', async (req, res) => {
            const page = parseInt(req.query.page) || 0;
            const size = parseInt(req.query.size) || 10;
            const sortBy = { createdAt: -1 };

            try {
                const campaignsWithDonations = await campaignsCollection.aggregate([
                    { $sort: sortBy },
                    { $skip: page * size },
                    { $limit: size },
                    {
                        // Convert _id ObjectId to string to match with campaignId in donations
                        $addFields: {
                            _idStr: { $toString: '$_id' }
                        }
                    },
                    {
                        $lookup: {
                            from: 'donations',
                            let: { campaignId: '$_idStr' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $eq: ['$campaignId', '$$campaignId'] }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 0,
                                        amount: 1,
                                        donorName: 1,
                                        createdAt: 1
                                    }
                                },
                                { $sort: { createdAt: -1 } }
                            ],
                            as: 'donations'
                        }
                    },
                    // Optionally remove the _idStr field from output
                    {
                        $project: {
                            _idStr: 0
                        }
                    }
                ]).toArray();

                res.send(campaignsWithDonations);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to fetch campaigns with donations' });
            }
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
            const page = parseInt(req.query.page) || 0;
            const size = parseInt(req.query.size) || 10;
            const email = req.tokenUser.email;
            const query = { addedBy: email };
            const sortBy = { createdAt: -1 };

            try {
                const campaignsWithDonations = await campaignsCollection.aggregate([
                    { $match: query },
                    { $sort: sortBy },
                    { $skip: page * size },
                    { $limit: size },
                    {
                        // Convert _id ObjectId to string to match with campaignId in donations
                        $addFields: {
                            _idStr: { $toString: '$_id' }
                        }
                    },
                    {
                        $lookup: {
                            from: 'donations',
                            let: { campaignId: '$_idStr' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $eq: ['$campaignId', '$$campaignId'] }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 0,
                                        amount: 1,
                                        donorName: 1,
                                        createdAt: 1
                                    }
                                },
                                { $sort: { createdAt: -1 } }
                            ],
                            as: 'donations'
                        }
                    },
                    // Optionally remove the _idStr field from output
                    {
                        $project: {
                            _idStr: 0
                        }
                    }
                ]).toArray();

                res.send(campaignsWithDonations);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to fetch campaigns with donations' });
            }
        });


        app.patch('/campaigns', verifyFirebase, async (req, res) => {
            const addedBy = req.tokenUser.email
            const campaignData = req.body.data.campaignData
            const { _id, paused } = campaignData
            const query = { _id: new ObjectId(_id), addedBy }

            try {
                const result = await campaignsCollection.updateOne(
                    query,
                    { $set: { paused: paused } }
                );
                if (result.modifiedCount === 0) {
                    return res.status(404).send({ error: 'Adoption not found or already updated' });
                }
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to update status' });
            }
        })









        app.post('/adoptions',verifyFirebase, async (req, res) => {
            const adoptionData = req.body
            const result = adoptionsCollection.insertOne(adoptionData)
            res.send(result)
        })

        app.get('/adoptions/:id', async (req, res) => {
            const id = req.params.id
            const query = {}
            if (id !== 'all') {
                query = { _id: new ObjectId(id) }
            }
            const result = await adoptionsCollection.find(query).toArray()
            res.send(result)
        })

        app.patch('/adoptions',verifyFirebase, async (req, res) => {
            const { updateData } = req.body.data
            const { _id, status } = updateData
            try {
                const result = await adoptionsCollection.updateOne(
                    { _id: new ObjectId(_id) },
                    { $set: { status: status } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ error: 'Adoption not found or already updated' });
                }

                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to update status' });
            }

        })

        app.get('/adoption-requests-count',verifyFirebase, async (req, res) => {
            const email = req.query.email;

            const countResult = await petsCollection.aggregate([
                { $match: { addedBy: email } },
                {
                    $addFields: {
                        _idStr: { $toString: '$_id' }
                    }
                },
                {
                    $lookup: {
                        from: 'adoptions',
                        localField: '_idStr',
                        foreignField: 'petId',
                        as: 'adoptionInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$adoptionInfo',
                        preserveNullAndEmptyArrays: false
                    }
                },
                {
                    $count: 'total'
                }
            ]).toArray();

            const total = countResult[0]?.total || 0;

            res.send(total)
        })

        app.get('/adoption-requests',verifyFirebase, async (req, res) => {
            const email = req.query.email;

            // Pagination params
            const page = parseInt(req.query.page) || 0
            const size = parseInt(req.query.size) || 10
            const skip = page * size;

            const result = await petsCollection.aggregate([
                {
                    $match: {
                        addedBy: email
                    }
                },
                {
                    $addFields: {
                        _idStr: { $toString: '$_id' }
                    }
                },
                {
                    $lookup: {
                        from: 'adoptions',
                        localField: '_idStr',
                        foreignField: 'petId',
                        as: 'adoptionInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$adoptionInfo',
                        preserveNullAndEmptyArrays: false
                    }
                },
                {
                    $sort: {
                        'adoptionInfo.requestDate': -1 // most recent first
                    }
                },
                {
                    $skip: skip
                },
                {
                    $limit: size
                }
            ]).toArray();

            res.send(result);
        });














        app.post('/create-payment-intent',verifyFirebase, async (req, res) => {
            const amountInCents = req.body.amountInCents
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountInCents,
                    currency: 'usd',
                    payment_method_types: ['card'],
                });
                res.json({ clientSecret: paymentIntent.client_secret })
            } catch (error) {
                res.status(500).json({ error: error.message })
            }
        })

        app.post('/donations',verifyFirebase, async (req, res) => {
            const donationData = req.body
            const result = await donationsCollections.insertOne(donationData)
            res.send(result)
        })

        app.delete('/donations',verifyFirebase, async (req, res) => {
            const id = req.body.id
            const query = { _id: new ObjectId(id) }
            const result = await donationsCollections.deleteOne(query)
            res.send(result)
        })

        app.get('/my-donations-count', verifyFirebase, async (req, res) => {
            const email = req.tokenUser.email;
            const query = { donorEmail: email };
            const result = await donationsCollections.countDocuments(query)
            res.send(result)
        })

        app.get('/my-donations', verifyFirebase, async (req, res) => {
            const page = parseInt(req.query.page) || 0;
            const size = parseInt(req.query.size) || 10;

            const email = req.tokenUser.email;
            const query = { donorEmail: email };
            const sortBy = { createdAt: -1 };

            const result = await donationsCollections
                .find(query)
                .sort(sortBy)
                .skip(page * size)
                .limit(size)
                .toArray();
            res.send(result)
        });


        app.get('/donations/:id', async (req, res) => {
            const campaignId = req.params.id
            if (campaignId === 'all') {
                const result = await donationsCollections.find().toArray()
                return res.send(result)
            }

            try {
                const matchStage = campaignId ? { campaignId } : {};

                const pipeline = [
                    { $match: matchStage },
                    { $sort: { createdAt: -1 } },
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: "$amount" },
                            donations: { $push: "$$ROOT" }
                        }
                    }
                ];

                const result = await donationsCollections.aggregate(pipeline).toArray();

                if (result.length === 0) {
                    return res.send({ totalAmount: 0, donations: [] });
                }

                const { totalAmount, donations } = result[0];
                res.send({ totalAmount, donations });

            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch donations' });
            }
        });





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