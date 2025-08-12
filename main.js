import { auth, db } from './firebase-config.js';
import { doc, collection, onSnapshot, setDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initAuth, signUpWithEmail, signInWithEmail, signInWithGoogle, appSignOut, resetPassword } from './auth.js';

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('main-content');
const noteList = document.getElementById('note-list');
const noteEditorContainer = document.getElementById('note-editor-container');
const placeholderView = document.getElementById('placeholder-view');
const noteTitleInput = document.getElementById('note-title-input');
const noteContentInput = document.getElementById('note-content-input');
const saveStatus = document.getElementById('save-status');
const selectNotesBtn = document.getElementById('select-notes-btn');
const defaultActions = document.getElementById('default-actions');
const multiselectActions = document.getElementById('multiselect-actions');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const cancelMultiselectBtn = document.getElementById('cancel-multiselect-btn');

let currentUser = null;
let activeNoteId = null;
let allNotes = []; // Keep a local copy of all notes
let unsubscribeFromNotes = null;
let titleDebounceTimer = null;
let contentDebounceTimer = null;
let isMultiSelectMode = false;
let selectedNoteIds = new Set();
let deletionPending = null;
let deletionTimer = null;

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
    
    const notesCollectionRef = collection(db, "users", user.uid, "notes");
    const q = query(notesCollectionRef, orderBy("updatedAt", "desc"));

    unsubscribeFromNotes = onSnapshot(q, (snapshot) => {
        allNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderNoteList(allNotes);

        // Auto-select the top note if none is active
        if (!activeNoteId && allNotes.length > 0) {
            selectNote(allNotes[0]);
        }
        
        if (activeNoteId && snapshot.docChanges().some(change => change.doc.id === activeNoteId && change.type === 'modified')) {
            const activeNoteData = allNotes.find(note => note.id === activeNoteId);
            if (activeNoteData) {
                updateEditor(activeNoteData);
            }
        }
    });
    showAppView();
}

function renderNoteList(notes) {
    noteList.innerHTML = '';
    if (notes.length === 0) {
        noteEditorContainer.classList.add('hidden');
        placeholderView.classList.remove('hidden');
        selectNotesBtn.classList.add('hidden');
        return;
    }
    selectNotesBtn.classList.remove('hidden');

    notes.forEach(note => {
        const item = document.createElement('div');
        item.className = 'note-item';
        item.dataset.id = note.id;
        if (note.id === activeNoteId && !isMultiSelectMode) {
            item.classList.add('active');
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'note-item-checkbox';
        checkbox.dataset.id = note.id;
        checkbox.checked = selectedNoteIds.has(note.id);
        checkbox.classList.toggle('hidden', !isMultiSelectMode);
        checkbox.addEventListener('change', handleNoteSelectionChange);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'note-item-content';

        const title = document.createElement('div');
        title.className = 'note-item-title';
        title.textContent = note.title || 'Untitled Note';
        
        const snippet = document.createElement('div');
        snippet.className = 'note-item-snippet';
        snippet.textContent = note.content ? note.content.substring(0, 40) + '...' : 'No additional text';

        contentWrapper.appendChild(title);
        contentWrapper.appendChild(snippet);
        
        item.appendChild(checkbox);
        item.appendChild(contentWrapper);
        
        item.addEventListener('click', (e) => {
            if (isMultiSelectMode) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            } else {
                selectNote(note);
            }
        });
        noteList.appendChild(item);
    });
}

function selectNote(note) {
    if (isMultiSelectMode) toggleMultiSelectMode();
    activeNoteId = note.id;
    updateEditor(note);
    
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === activeNoteId);
    });

    placeholderView.classList.add('hidden');
    noteEditorContainer.classList.remove('hidden');
}

function updateEditor(note) {
    if (noteTitleInput.value !== note.title) noteTitleInput.value = note.title || '';
    if (noteContentInput.value !== note.content) noteContentInput.value = note.content || '';
    saveStatus.textContent = "All changes saved.";
}

// --- Sidebar ---
function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('collapsed');
}

// --- Multi-Select Functions ---
function toggleMultiSelectMode() {
    isMultiSelectMode = !isMultiSelectMode;
    selectedNoteIds.clear();
    
    defaultActions.classList.toggle('hidden', isMultiSelectMode);
    multiselectActions.classList.toggle('hidden', !isMultiSelectMode);
    
    document.querySelectorAll('.note-item-checkbox').forEach(cb => {
        cb.classList.toggle('hidden', !isMultiSelectMode);
        cb.checked = false;
    });
    document.querySelectorAll('.note-item.active').forEach(item => item.classList.remove('active'));
    updateDeleteButtonState();
}

function handleNoteSelectionChange(e) {
    const noteId = e.target.dataset.id;
    if (e.target.checked) {
        selectedNoteIds.add(noteId);
    } else {
        selectedNoteIds.delete(noteId);
    }
    updateDeleteButtonState();
}

function updateDeleteButtonState() {
    const count = selectedNoteIds.size;
    deleteSelectedBtn.disabled = count === 0;
    const deleteText = deleteSelectedBtn.querySelector('.sidebar-text');
    if (deleteText) {
        deleteText.textContent = `Delete (${count})`;
    }
}

// --- Data Functions ---
async function createNewNote() {
    if (isMultiSelectMode) toggleMultiSelectMode();
    if (!currentUser) return;
    const notesCollectionRef = collection(db, "users", currentUser.uid, "notes");
    try {
        const newNoteRef = await addDoc(notesCollectionRef, {
            title: "Untitled Note",
            content: "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        // The onSnapshot listener will automatically add the new note to the top
        // and our logic will select it.
    } catch (error) {
        console.error("Error creating new note:", error);
        showMessage("Could not create a new note.", "error");
    }
}

async function deleteActiveNote() {
    if (!currentUser || !activeNoteId) return;

    if (deletionPending === activeNoteId) {
        clearTimeout(deletionTimer);
        const noteDocRef = doc(db, "users", currentUser.uid, "notes", activeNoteId);
        const deletedNoteIndex = allNotes.findIndex(note => note.id === activeNoteId);
        try {
            await deleteDoc(noteDocRef);
            showMessage("Note deleted.", 'success');
            activeNoteId = null;
            deletionPending = null;
            
            // Auto-select next note
            const remainingNotes = allNotes.filter(note => note.id !== noteDocRef.id);
            if (remainingNotes.length > 0) {
                const newIndex = Math.min(deletedNoteIndex, remainingNotes.length - 1);
                selectNote(remainingNotes[newIndex]);
            } else {
                noteEditorContainer.classList.add('hidden');
                placeholderView.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error deleting note:", error);
            showMessage("Could not delete the note.", "error");
        }
    } else {
        deletionPending = activeNoteId;
        showMessage("Click delete again to confirm.", 'info');
        clearTimeout(deletionTimer);
        deletionTimer = setTimeout(() => { deletionPending = null; }, 5000);
    }
}

async function deleteSelectedNotes() {
    if (!currentUser || selectedNoteIds.size === 0) return;

    if (deletionPending === 'multiselect') {
        clearTimeout(deletionTimer);
        const batch = writeBatch(db);
        selectedNoteIds.forEach(noteId => {
            const noteDocRef = doc(db, "users", currentUser.uid, "notes", noteId);
            batch.delete(noteDocRef);
        });
        try {
            await batch.commit();
            showMessage(`${selectedNoteIds.size} notes deleted.`, 'success');
            if (selectedNoteIds.has(activeNoteId)) {
                activeNoteId = null;
                noteEditorContainer.classList.add('hidden');
                placeholderView.classList.remove('hidden');
            }
            deletionPending = null;
            toggleMultiSelectMode();
        } catch (error) {
            console.error("Error deleting notes:", error);
            showMessage("Could not delete notes.", "error");
        }
    } else {
        deletionPending = 'multiselect';
        showMessage(`Click delete again to confirm deleting ${selectedNoteIds.size} notes.`, 'info');
        clearTimeout(deletionTimer);
        deletionTimer = setTimeout(() => { deletionPending = null; }, 5000);
    }
}

function saveNote(field, value) {
    if (!currentUser || !activeNoteId) return;
    saveStatus.textContent = "Saving...";
    const noteDocRef = doc(db, "users", currentUser.uid, "notes", activeNoteId);
    setDoc(noteDocRef, { 
        [field]: value,
        updatedAt: serverTimestamp() 
    }, { merge: true })
    .then(() => saveStatus.textContent = "All changes saved.")
    .catch(error => {
        console.error("Error saving note:", error);
        saveStatus.textContent = "Error saving.";
    });
}

function debouncedSave(field, value) {
    saveStatus.textContent = "Typing...";
    const timer = field === 'title' ? titleDebounceTimer : contentDebounceTimer;
    clearTimeout(timer);
    if (field === 'title') {
        titleDebounceTimer = setTimeout(() => saveNote(field, value), 500);
    } else {
        contentDebounceTimer = setTimeout(() => saveNote(field, value), 500);
    }
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
    document.getElementById('new-note-btn').addEventListener('click', createNewNote);
    document.getElementById('delete-note-btn').addEventListener('click', deleteActiveNote);
    selectNotesBtn.addEventListener('click', toggleMultiSelectMode);
    cancelMultiselectBtn.addEventListener('click', toggleMultiSelectMode);
    deleteSelectedBtn.addEventListener('click', deleteSelectedNotes);
    document.getElementById('hamburger-btn').addEventListener('click', toggleSidebar);

    noteTitleInput.addEventListener('input', (e) => debouncedSave('title', e.target.value));
    noteContentInput.addEventListener('input', (e) => debouncedSave('content', e.target.value));

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
