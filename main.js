import { auth, db } from './firebase-config.js';
import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initAuth, signUpWithEmail, signInWithEmail, signInWithGoogle, appSignOut, resetPassword } from './auth.js';

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const noteInput = document.getElementById('note-input');
const saveStatus = document.getElementById('save-status');

let currentUser = null;
let unsubscribeFromNotes = null;
let debounceTimer = null;

// --- UI Functions ---
export function showLoginView() {
    document.querySelector('.main-container').classList.remove('is-app-view');
    appView.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        appView.classList.add('hidden');
        loginView.classList.remove('hidden');
        loginView.classList.remove('opacity-0', 'scale-95');
    }, 300);
}

export function showAppView() {
    document.querySelector('.main-container').classList.add('is-app-view');
    loginView.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        loginView.classList.add('hidden');
        appView.classList.remove('hidden');
        appView.classList.remove('opacity-0', 'scale-95');
    }, 300);
}

export function handleUserLogin(user) {
    currentUser = user;
    if (unsubscribeFromNotes) unsubscribeFromNotes();
    
    const noteDocRef = doc(db, "notes", user.uid);
    unsubscribeFromNotes = onSnapshot(noteDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (noteInput.value !== data.content) {
                noteInput.value = data.content;
            }
        } else {
            setDoc(noteDocRef, { content: "" });
        }
        saveStatus.textContent = "All changes saved.";
    });
    showAppView();
}

// --- Data Functions ---
function saveNote() {
    if (!currentUser) return;
    saveStatus.textContent = "Saving...";
    const noteDocRef = doc(db, "notes", currentUser.uid);
    setDoc(noteDocRef, { content: noteInput.value }, { merge: true })
        .then(() => {
            saveStatus.textContent = "All changes saved.";
        })
        .catch(error => {
            console.error("Error saving note:", error);
            saveStatus.textContent = "Error saving.";
        });
}

function debouncedSave() {
    clearTimeout(debounceTimer);
    saveStatus.textContent = "Typing...";
    debounceTimer = setTimeout(saveNote, 500);
}

// --- Event Listeners ---
function setupEventListeners() {
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    
    document.getElementById('email-signup-btn').addEventListener('click', () => signUpWithEmail(emailInput.value, passwordInput.value));
    document.getElementById('email-signin-btn').addEventListener('click', () => signInWithEmail(emailInput.value, passwordInput.value));
    document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);
    document.getElementById('sign-out-btn').addEventListener('click', appSignOut);
    document.getElementById('forgot-password-btn').addEventListener('click', () => resetPassword(emailInput.value));

    noteInput.addEventListener('input', debouncedSave);

    const passwordToggleBtn = document.getElementById('password-toggle-btn');
    const passwordToggleIcon = document.getElementById('password-toggle-icon');
    passwordToggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggleIcon.classList.toggle('fa-eye-slash', !isPassword);
        passwordToggleIcon.classList.toggle('fa-eye', isPassword);
    });
}

// --- Utility Functions ---
export function showMessage(msg, type = 'info') {
    const messageDisplay = document.getElementById('message-display');
    const messageText = document.getElementById('message-text');
    messageText.textContent = msg;
    messageDisplay.className = 'fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-md transition-opacity duration-300';
    if (type === 'error') {
        messageDisplay.classList.add('bg-red-100', 'border', 'border-red-400', 'text-red-700');
    } else {
        messageDisplay.classList.add('bg-green-100', 'border', 'border-green-400', 'text-green-700');
    }
    messageDisplay.classList.add('show');
    setTimeout(() => messageDisplay.classList.remove('show'), 3000);
}

export function setButtonLoadingState(button, isLoading) {
    const spinner = button.querySelector('.fa-spinner');
    const content = button.querySelector('.button-content');
    const googleIcon = button.querySelector('.google-icon');

    if (isLoading) {
        if (content) content.classList.add('hidden');
        // Only hide the Google icon if it's NOT the Google button
        if (googleIcon && button.id !== 'google-signin-btn') {
            googleIcon.classList.add('hidden');
        }
        if (spinner) spinner.classList.remove('hidden');
        button.disabled = true;
    } else {
        if (content) content.classList.remove('hidden');
        if (googleIcon) googleIcon.classList.remove('hidden');
        if (spinner) spinner.classList.add('hidden');
        button.disabled = false;
    }
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initAuth();
});
