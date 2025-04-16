// Import Firebase modules correctly
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, onSnapshot, doc, deleteDoc, updateDoc, arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB-Hlmm39BUkKE2miVxXmXlQpnR7e4oReo",
    authDomain: "chefpanda-6d014.firebaseapp.com",
    projectId: "chefpanda-6d014",
    storageBucket: "chefpanda-6d014.appspot.com",
    messagingSenderId: "214664382808",
    appId: "1:214664382808:web:1430f61cf4b2b490343d2d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// UI Elements
const userInfo = document.getElementById("user-info");
const usernameDisplay = document.getElementById("username");
const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const submitPostButton = document.getElementById("submit-post");
const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const postsContainer = document.getElementById("posts");
const loader = document.getElementById("loader");

function showLoader() {
    loader.classList.remove("hidden");
}

function hideLoader() {
    loader.classList.add("hidden");
}

// Google Login
loginButton.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login Error:", error);
    }
});

// Logout
logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error);
    }
});

// Track authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginButton.style.display = "none";
        logoutButton.style.display = "block";
        submitPostButton.disabled = false;

        if (userInfo && usernameDisplay) {
            usernameDisplay.textContent = user.displayName;
            userInfo.style.display = "block";
        }
    } else {
        loginButton.style.display = "block";
        logoutButton.style.display = "none";
        submitPostButton.disabled = true;

        if (userInfo && usernameDisplay) {
            usernameDisplay.textContent = "";
            userInfo.style.display = "none";
        }
    }
});

// Submit a new post
submitPostButton.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in to post!");

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    if (!title || !content) return alert("Title and content cannot be empty!");

    try {
        showLoader();
        await addDoc(collection(db, "posts"), {
            title,
            content,
            author: user.displayName,
            uid: user.uid,
            timestamp: serverTimestamp(),
            likes: 0,
            replies: [],
            likedBy: []  // ✅ Added
        });
        alert("Post added successfully!");        
        titleInput.value = "";
        contentInput.value = "";
    } catch (error) {
        console.error("Error adding post:", error);
    } finally {
        hideLoader();
    }
});

function loadPosts() {
    postsContainer.innerHTML = "";
    showLoader();

    onSnapshot(query(collection(db, "posts"), orderBy("timestamp", "desc")), (snapshot) => {
        postsContainer.innerHTML = "";
        hideLoader();

        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const postId = docSnap.id;

            const postElement = document.createElement("div");
            postElement.className = "post";
            postElement.innerHTML = `
                <div id="pp">
                    <div id="an">
                        <img id="aimg" src="panda.webp" alt="">
                        <small><strong id="str">${post.author}</strong> | ${new Date(post.timestamp?.seconds * 1000).toLocaleString()}</small>
                    </div>
                    <h3 id="tits">${post.title}</h3>
                    <p>${post.content}</p>
                    <button onclick="likePost('${postId}', ${post.likes || 0})">❤️ ${post.likes || 0}</button>
                    <button onclick="showReplyForm('${postId}')">Reply</button>
                    ${auth.currentUser && auth.currentUser.uid === post.uid ? `<button onclick="deletePost('${postId}')">🗑 Delete</button>` : ""}
                    <div id="replies-${postId}"></div>
                    <div id="reply-form-${postId}" style="display: none;">
                        <input type="text" id="reply-input-${postId}" placeholder="Write a reply">
                        <button onclick="submitReply('${postId}')">Submit</button>
                    </div>
                </div>
            `;
            postsContainer.appendChild(postElement);

            const repliesContainer = document.getElementById(`replies-${postId}`);
            if (post.replies) {
                post.replies.forEach(reply => {
                    const replyElement = document.createElement("div");
                    replyElement.className = "reply";
                    replyElement.innerHTML = `<p>${reply.text}</p><small>By <strong>${reply.author}</strong></small>`;
                    repliesContainer.appendChild(replyElement);
                });
            }
        });
    });
}

window.showReplyForm = (postId) => {
    document.getElementById(`reply-form-${postId}`).style.display = "block";
};

window.submitReply = async (postId) => {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in to reply!");

    const replyInput = document.getElementById(`reply-input-${postId}`);
    const replyText = replyInput.value.trim();
    if (!replyText) return;

    const postRef = doc(db, "posts", postId);
    try {
        showLoader();
        await updateDoc(postRef, {
            replies: arrayUnion({ text: replyText, author: user.displayName })
        });
        replyInput.value = "";
    } catch (error) {
        console.error("Error submitting reply:", error);
    } finally {
        hideLoader();
    }
};

window.likePost = async (postId) => {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in to like!");

    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) return;

    const postData = postSnap.data();
    const alreadyLiked = postData.likedBy?.includes(user.uid);

    if (alreadyLiked) {
        alert("You've already liked this post!");
        return;
    }

    try {
        await updateDoc(postRef, {
            likes: increment(1),
            likedBy: arrayUnion(user.uid)
        });
    } catch (error) {
        console.error("Error updating likes:", error);
    }
};


window.deletePost = async (postId) => {
    try {
        showLoader();
        await deleteDoc(doc(db, "posts", postId));
    } catch (error) {
        console.error("Error deleting post:", error);
    } finally {
        hideLoader();
    }
};

document.addEventListener("DOMContentLoaded", loadPosts);
