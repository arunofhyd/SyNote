import { auth, db } from './firebase-config.js';
import { collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initAuth, signUpWithEmail, signInWithEmail, signInWithGoogle, appSignOut, resetPassword } from './auth.js';

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const noteInput = document.getElementById('note-input');
const noteTitle = document.getElementById('note-title');
const notesList = document.getElementById('notes-list');
const saveStatus = document.getElementById('save-status');
const mainContainer = document.querySelector('.main-container');

let currentUser = null;
let currentNoteId = null;
let unsubscribeFromNotes = null;
let unsubscribeFromCurrentNote = null;
let debounceTimer = null;
let actionPending = null;
let actionTimer = null;

// --- UI Functions ---
export function showLoginView() {
    mainContainer.classList.remove('is-app-view');
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
        mainContainer.classList.add('is-app-view');
        loginView.classList.add('hidden');
        appView.classList.remove('hidden');
        appView.classList.remove('opacity-0', 'scale-95');
    }, 300);
}

function renderNotesList(notes) {
    notesList.innerHTML = '';
    if (notes.length === 0) {
        notesList.innerHTML = '<p class="text-gray-500 text-center">No notes yet.</p>';
        noteTitle.value = '';
        noteInput.value = '';
        noteTitle.disabled = true;
        noteInput.disabled = true;
        return;
    }

    noteTitle.disabled = false;
    noteInput.disabled = false;

    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.classList.add('note-item', 'flex', 'justify-between', 'items-center');
        noteElement.dataset.id = note.id;
        if (note.id === currentNoteId) {
            noteElement.classList.add('active');
        }
        noteElement.innerHTML = `
            <h3 class="note-item-title">${note.title || 'Untitled Note'}</h3>
            <div class="note-item-actions">
                <button class="rename-note-btn"><i class="fas fa-pencil-alt"></i></button>
                <button class="delete-note-btn"><i class="fas fa-trash"></i></button>
            </div>
        `;
        noteElement.querySelector('.rename-note-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            renameNote(note.id, note.title);
        });
        noteElement.querySelector('.delete-note-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNote(note.id);
        });
        noteElement.addEventListener('click', () => loadNote(note.id));
        notesList.appendChild(noteElement);
    });
}

function loadNote(id) {
    if (unsubscribeFromCurrentNote) {
        unsubscribeFromCurrentNote();
    }

    currentNoteId = id;
    const noteDocRef = doc(db, "users", currentUser.uid, "notes", id);

    unsubscribeFromCurrentNote = onSnapshot(noteDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const noteData = docSnapshot.data();
            const cursorPosition = noteInput.selectionStart;

            noteTitle.value = noteData.title;
            noteInput.value = noteData.content;

            noteInput.setSelectionRange(cursorPosition, cursorPosition);
        }
    });

    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNoteElement = document.querySelector(`.note-item[data-id='${id}']`);
    if (activeNoteElement) {
        activeNoteElement.classList.add('active');
    }
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('sidebar-open');
        document.getElementById('content-overlay').classList.add('hidden');
    }
}

export function handleUserLogin(user) {
    currentUser = user;
    if (unsubscribeFromNotes) unsubscribeFromNotes();

    const notesCollectionRef = collection(db, "users", currentUser.uid, "notes");
    const q = query(notesCollectionRef, orderBy("createdAt", "desc"));

    unsubscribeFromNotes = onSnapshot(q, (snapshot) => {
        const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderNotesList(notes);
        if (notes.length > 0 && !currentNoteId) {
            loadNote(notes[0].id);
        } else if (notes.length === 0) {
            currentNoteId = null;
        }
    });
    showAppView();
}

// --- Data Functions ---
async function createNewNote() {
    if (!currentUser) return;
    const notesCollectionRef = collection(db, "users", currentUser.uid, "notes");
    const newNote = {
        title: "Untitled Note",
        content: "",
        createdAt: new Date()
    };
    try {
        const docRef = await addDoc(notesCollectionRef, newNote);
        loadNote(docRef.id);
    } catch (error) {
        console.error("Error creating new note:", error);
        showMessage("Failed to create new note.", 'error');
    }
}

async function renameNote(noteId, currentTitle) {
    const newTitle = prompt("Enter new title:", currentTitle);
    if (newTitle && newTitle.trim() !== "") {
        const noteDocRef = doc(db, "users", currentUser.uid, "notes", noteId);
        try {
            await setDoc(noteDocRef, { title: newTitle }, { merge: true });
            showMessage("Note renamed.", 'success');
        } catch (error) {
            console.error("Error renaming note:", error);
            showMessage("Failed to rename note.", 'error');
        }
    }
}

async function deleteNote(noteId) {
    if (actionPending === `delete-${noteId}`) {
        clearTimeout(actionTimer);
        actionPending = null;
        if (!currentUser || !noteId) return;
        const noteDocRef = doc(db, "users", currentUser.uid, "notes", noteId);
        try {
            await deleteDoc(noteDocRef);
            if (currentNoteId === noteId) {
                currentNoteId = null;
            }
            showMessage("Note deleted.", 'success');
        } catch (error) {
            console.error("Error deleting note:", error);
            showMessage("Failed to delete note.", 'error');
        }
    } else {
        actionPending = `delete-${noteId}`;
        showMessage("Click the trash icon again to confirm deletion.", 'info');
        actionTimer = setTimeout(() => { actionPending = null; }, 5000);
    }
}

function saveNote() {
    if (!currentUser || !currentNoteId) return;
    saveStatus.textContent = "Saving...";
    const noteDocRef = doc(db, "users", currentUser.uid, "notes", currentNoteId);
    setDoc(noteDocRef, { title: noteTitle.value, content: noteInput.value }, { merge: true })
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

    noteTitle.addEventListener('input', debouncedSave);
    noteInput.addEventListener('input', debouncedSave);

    document.getElementById('menu-btn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('sidebar-open');
        document.getElementById('content-overlay').classList.toggle('hidden');
    });

    document.getElementById('content-overlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('sidebar-open');
        document.getElementById('content-overlay').classList.add('hidden');
    });

    document.getElementById('new-note-btn').addEventListener('click', createNewNote);
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

    const passwordToggleBtn = document.getElementById('password-toggle-btn');
    const passwordToggleIcon = document.getElementById('password-toggle-icon');
    
    passwordToggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        if (isPassword) {
            passwordInput.type = 'text';
            passwordToggleIcon.classList.remove('fa-eye');
            passwordToggleIcon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            passwordToggleIcon.classList.remove('fa-eye-slash');
            passwordToggleIcon.classList.add('fa-eye');
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

export function setButtonLoadingState(button, isLoading) {
    const spinner = button.querySelector('.fa-spinner');
    const content = button.querySelector('.button-content');
    const googleIcon = button.querySelector('.google-icon');

    if (isLoading) {
        if (content) content.classList.add('hidden');
        if (googleIcon) googleIcon.classList.remove('hidden');
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
