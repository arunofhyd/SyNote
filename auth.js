import {
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from './firebase-config.js';
import { showMessage, setButtonLoadingState, showLoginView, showAppView, handleUserLogin as uiHandleUserLogin } from './main.js';

function handleUserLogin(user) {
    uiHandleUserLogin(user);
}

function handleUserLogout() {
    showLoginView();
}

export function initAuth() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            handleUserLogin(user);
        } else {
            handleUserLogout();
        }
    });
}

export async function signUpWithEmail(email, password) {
    const button = document.getElementById('email-signup-btn');
    if (!email || password.length < 6) {
        return showMessage("Email and a password of at least 6 characters are required.", 'error');
    }
    setButtonLoadingState(button, true, 'Sign Up');
    try {
        await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showMessage(`Sign-up failed: ${error.message}`, 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

export async function signInWithEmail(email, password) {
    const button = document.getElementById('email-signin-btn');
    if (!email || !password) {
        return showMessage("Email and password are required.", 'error');
    }
    setButtonLoadingState(button, true, 'Sign In');
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showMessage(`Sign-in failed: ${error.message}`, 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        showMessage(`Google sign-in failed: ${error.message}`, 'error');
    }
}

export async function appSignOut() {
    try {
        await signOut(auth);
    } catch (error) {
        showMessage(`Sign-out failed: ${error.message}`, 'error');
    }
}

export async function resetPassword(email) {
    if (!email) {
        return showMessage("Please enter your email address to reset your password.", 'error');
    }
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Password reset email sent! Please check your inbox.", 'success');
    } catch (error) {
        showMessage(`Error sending reset email: ${error.message}`, 'error');
    }
}
