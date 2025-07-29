# 🐾 PetLink Server

This is the backend server for the **PetLink** platform — a full-featured pet adoption and donation system. The server is built using **Node.js**, **Express**, **MongoDB**, **Firebase Admin**, and **Stripe** for secure payment handling.

---

## 🚀 Live Server

🔗 Hosted URL: https://pet-link-server.vercel.app/

---

## 🧰 Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square\&logo=nodedotjs\&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=flat-square\&logo=express\&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat-square\&logo=mongodb\&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square\&logo=firebase\&logoColor=black)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat-square\&logo=stripe\&logoColor=white)

---

## 📦 Features

### 🔐 Authentication

* Firebase Admin SDK used to verify client JWT tokens.

### 👤 User Management

* Register, update, and fetch user profiles.
* Role-based access control (user/admin).

### 🐶 Pet Management

* Add, update, delete pets (auth required).
* Fetch pets with filters: category, search term, adoption status.
* Get list of unique categories.

### ❤️ Adoption

* Submit adoption requests.
* Fetch and update adoption request status.
* View requests for user’s pets.

### 🎯 Campaigns

* Create and manage donation campaigns.
* Link donations to campaigns.
* Pause/resume campaigns.
* List campaigns with pagination and donation aggregation.

### 💳 Payments & Donations

* Stripe integration for creating payment intents.
* Store donations linked to users and campaigns.
* Fetch total donation amount per campaign.

### 📊 Analytics

* Get total counts for users, pets, campaigns, and user-contributed content.

---

## 📁 API Structure

| Endpoint                                                    | Method                                  | Description                                     |
| ----------------------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| `/users`, `/pets`, `/campaigns`, `/adoptions`, `/donations` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | Full CRUD operations                            |
| `/my-*`                                                     | `GET`                                   | Personalized data by user email (auth required) |
| `/create-payment-intent`                                    | `POST`                                  | Initiate Stripe payment flow                    |

All protected routes require a valid Firebase token in the `Authorization` header.

---

## 🔐 Environment Variables

Create a `.env` file at the root with:

```env
PORT=3000
DB_USER=yourMongoUsername
DB_PASS=yourMongoPassword
PAYMENT_GATEWAY_KEY=yourStripeSecretKey
FB_SERVICE_KEY=yourBase64EncodedFirebaseServiceKey
```

Note: The `FB_SERVICE_KEY` should be base64 encoded JSON of your Firebase service key.

---

## 🏁 Getting Started

```bash
git clone https://github.com/yourusername/petlink-server.git
cd petlink-server
npm install
npm run start
```

---

## 📌 Deployment Notes

* Be sure to secure your environment variables in production.
* For Firebase Admin SDK, you may want to load the key from a secure secrets manager.
* You can host this server on **Render**, **Railway**, **Vercel (serverless)**, or **any VPS**.

---

## 🧪 Sample Test Routes

```http
GET /users-count
GET /pets?category=dog&search=bulldog
POST /create-payment-intent
```


---

## 📝 License

MIT License
