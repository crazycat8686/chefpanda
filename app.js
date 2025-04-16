// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy,
  serverTimestamp, onSnapshot, doc, deleteDoc, updateDoc,
  arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB-Hlmm39BUkKE2miVxXmXlQpnR7e4oReo",
  authDomain: "chefpanda-6d014.firebaseapp.com",
  projectId: "chefpanda-6d014",
  storageBucket: "chefpanda-6d014.appspot.com",
  messagingSenderId: "214664382808",
  appId: "1:214664382808:web:1430f61cf4b2b490343d2d"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM elements
const userInfo = document.getElementById("user-info");
const usernameDisplay = document.getElementById("username");
const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const submitPostButton = document.getElementById("submit-post");
const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const postsContainer = document.getElementById("posts");
const loader = document.getElementById("loader");

// Loader
const showLoader = () => loader.style.display = "flex";
const hideLoader = () => loader.style.display = "none";

// Auth events
loginButton.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    showLoader();
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert("Login failed!");
    console.error(error);
  } finally {
    hideLoader();
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
  }
});

// Auth state listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginButton.style.display = "none";
    logoutButton.style.display = "block";
    submitPostButton.disabled = false;
    usernameDisplay.textContent = user.displayName;
    userInfo.style.display = "block";

    setTimeout(loadPosts, 100); // Wait to ensure user is initialized
  } else {
    loginButton.style.display = "block";
    logoutButton.style.display = "none";
    submitPostButton.disabled = true;
    usernameDisplay.textContent = "";
    userInfo.style.display = "none";
    postsContainer.innerHTML = "";
    hideLoader();
  }
});

// Submit a post
submitPostButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  if (!user || !title || !content) return alert("Fill all fields and login!");

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
      likesBy: []
    });
    titleInput.value = "";
    contentInput.value = "";
  } catch (error) {
    console.error("Error posting:", error);
  } finally {
    hideLoader();
  }
});

// Load posts and render
function loadPosts() {
  showLoader();
  try {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
      postsContainer.innerHTML = "";

      if (snapshot.empty) {
        postsContainer.innerHTML = "<p>No posts yet. Be the first to post!</p>";
        hideLoader();
        return;
      }

      snapshot.forEach((docSnap) => {
        const post = docSnap.data();
        const postId = docSnap.id;
        const currentUser = auth.currentUser;
        const isLiked = post.likesBy?.includes(currentUser?.uid);
        const postDate = post.timestamp?.seconds
          ? new Date(post.timestamp.seconds * 1000).toLocaleString()
          : "Just now";

        const postElement = document.createElement("div");
        postElement.className = "post";

        postElement.innerHTML = `
          <div id="pp">
            <div id="an">
              <img id="aimg" src="panda.webp" alt="">
              <small><strong id="str">${post.author}</strong> | ${postDate}</small>
            </div>
            <h3 id="tits">${post.title}</h3>
            <p>${post.content}</p>
            <button class="like-btn" data-id="${postId}" ${isLiked ? "disabled" : ""}>❤️ ${post.likes || 0}</button>
            <button onclick="showReplyForm('${postId}')">Reply</button>
            ${currentUser?.uid === post.uid ? `<button onclick="deletePost('${postId}')">🗑 Delete</button>` : ""}
            <div id="replies-${postId}"></div>
            <div id="reply-form-${postId}" style="display: none;">
              <input type="text" id="reply-input-${postId}" placeholder="Write a reply">
              <button onclick="submitReply('${postId}')">Submit</button>
            </div>
          </div>`;

        postsContainer.appendChild(postElement);

        const repliesContainer = document.getElementById(`replies-${postId}`);
        if (post.replies?.length > 0) {
          post.replies.forEach((reply) => {
            const replyElement = document.createElement("div");
            replyElement.className = "reply";
            replyElement.innerHTML = `<p>${reply.text}</p><small>By <strong>${reply.author}</strong></small>`;
            repliesContainer.appendChild(replyElement);
          });
        }
      });

      // Like button handling
      document.querySelectorAll(".like-btn").forEach((btn) => {
        btn.onclick = async () => {
          const user = auth.currentUser;
          const postId = btn.dataset.id;
          if (!user || btn.disabled) return;

          try {
            btn.disabled = true;
            const postRef = doc(db, "posts", postId);
            await updateDoc(postRef, {
              likes: increment(1),
              likesBy: arrayUnion(user.uid)
            });
          } catch (err) {
            console.error("Error liking post:", err);
          }
        };
      });

      hideLoader();
    }, (error) => {
      console.error("Snapshot listener error:", error);
      hideLoader();
    });
  } catch (err) {
    console.error("loadPosts error:", err);
    hideLoader();
  }

  // Safety timeout in case loader hangs
  setTimeout(() => {
    if (loader.style.display !== "none") {
      console.warn("Loader auto-hide fallback triggered.");
      hideLoader();
    }
  }, 5000);
}

// Show reply form
window.showReplyForm = (postId) => {
  document.getElementById(`reply-form-${postId}`).style.display = "block";
};

// Submit reply
window.submitReply = async (postId) => {
  const user = auth.currentUser;
  const input = document.getElementById(`reply-input-${postId}`);
  const reply = input.value.trim();
  if (!user || !reply) return;

  try {
    showLoader();
    await updateDoc(doc(db, "posts", postId), {
      replies: arrayUnion({
        text: reply,
        author: user.displayName
      })
    });
    input.value = "";
  } catch (error) {
    console.error("Reply error:", error);
  } finally {
    hideLoader();
  }
};

// Delete post
window.deletePost = async (postId) => {
  try {
    await deleteDoc(doc(db, "posts", postId));
  } catch (error) {
    console.error("Delete error:", error);
  }
};
