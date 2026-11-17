import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDy_1X_-GFbabWqBKRKQ0dkd0TBw1MsZ6E",
    authDomain: "synoteaoh.firebaseapp.com",
    projectId: "synoteaoh",
    storageBucket: "synoteaoh.appspot.com",
    messagingSenderId: "651867304240",
    appId: "1:651867304240:web:4769b293b0f261211758f5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
