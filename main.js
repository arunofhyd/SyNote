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
let actionPending = null; // To track pending confirmations (e.g., 'clear', 'signout')
let actionTimer = null; // Timer to reset the pending action

// --- UI Functions ---
export function showLoginView() {
    appView.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        appView.classList.add('hidden');
        loginView.classList.remove('hidden');
        loginView.classList.remove('opacity-0', 'scale-95');
    }, 300);
}

export function showAppView() {
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

    // --- Utility Button Listeners with Custom Confirmation ---
    document.getElementById('clear-all-btn').addEventListener('click', () => {
        if (actionPending === 'clear') {
            clearTimeout(actionTimer);
            actionPending = null;
            noteInput.value = "";
            saveNote();
            showMessage("Note cleared.", 'success');
        } else {
            actionPending = 'clear';
            showMessage("Click again to confirm clearing the note.", 'info');
            clearTimeout(actionTimer);
            actionTimer = setTimeout(() => {
                actionPending = null;
            }, 5000);
        }
    });

    document.getElementById('sign-out-btn').addEventListener('click', () => {
        if (actionPending === 'signout') {
            clearTimeout(actionTimer);
            actionPending = null;
            appSignOut();
        } else {
            actionPending = 'signout';
            showMessage("Click again to sign out.", 'info');
            clearTimeout(actionTimer);
            actionTimer = setTimeout(() => {
                actionPending = null;
            }, 5000);
        }
    });

    document.getElementById('copy-all-btn').addEventListener('click', () => {
        if (noteInput.value) {
            navigator.clipboard.writeText(noteInput.value)
                .then(() => showMessage("Copied to clipboard!", 'success'))
                .catch(err => showMessage("Failed to copy.", 'error'));
        }
    });

    document.getElementById('paste-all-btn').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                noteInput.value += text;
                saveNote(); // Save the new content immediately
            }
        } catch (err) {
            showMessage("Failed to paste from clipboard.", 'error');
        }
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
    } else if (type === 'info') {
        messageDisplay.classList.add('bg-blue-100', 'border', 'border-blue-400', 'text-blue-700');
    } else {
        messageDisplay.classList.add('bg-green-100', 'border', 'border-green-400', 'text-green-700');
    }
    messageDisplay.classList.add('show');
    setTimeout(() => messageDisplay.classList.remove('show'), 3000);
}

export function setButtonLoadingState(button, isLoading, originalText) {
    const spinner = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalContent = originalText;
        button.innerHTML = `${spinner}<span>Processing...</span>`;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalContent;
    }
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initAuth();
});
