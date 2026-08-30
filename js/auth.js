// js/auth.js

if (!window.AnimePlusAuthInitialized) {
  window.AnimePlusAuthInitialized = true;

  window.AnimePlusAuth = {
    currentUser: null,
    accessToken: null,
    isAuthLoaded: false,
    isLoggedIn: () => !!window.AnimePlusAuth.currentUser,
    
    logout: async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      } catch (e) {}
      window.AnimePlusAuth.accessToken = null;
      window.AnimePlusAuth.currentUser = null;
      localStorage.setItem("isLoggedIn", "false");
      
      document.documentElement.classList.remove("logged-in");
      document.documentElement.classList.add("logged-out");
      if (window.AnimePlusAuth.updateNavbarLoggedOut) {
        window.AnimePlusAuth.updateNavbarLoggedOut();
      }
      
      if (window.location.pathname.includes("profile.html") || window.location.pathname.includes("edit-profile.html")) {
        window.location.href = "home.html";
      }
    },
    
    openLoginModal: () => {
      const modal = document.getElementById("loginModal");
      const loginform = document.getElementById("loginform");
      const signupform = document.getElementById("signupform");
      const itm = document.getElementById("items");
      
      if (modal) modal.style.display = "flex";
      if (loginform) loginform.style.display = "block";
      if (signupform) signupform.style.display = "none";
      if (itm) itm.style.display = "block";
    },

    showToast: (message, type = "error") => {
      let container = document.getElementById("toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
      }

      container.innerHTML = "";

      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> 
        <span>${message}</span>
      `;

      container.appendChild(toast);
      
      setTimeout(() => toast.classList.add("show"), 10);

      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };

  // --- FETCH INTERCEPTOR FOR JWT ---
  const originalFetch = window.fetch;
  let isRefreshing = false;
  let refreshSubscribers = [];

  function onRefreshed(token) {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
  }

  window.fetch = async (...args) => {
    let [resource, config] = args;
    if (!config) config = {};
    
    // Always include credentials to send cookies (like RefreshToken) only for same-origin requests
    const isLocalRequest = typeof resource === "string" && (resource.startsWith("/") || resource.startsWith(window.location.origin));
    if (isLocalRequest) {
      config.credentials = "include";
    }

    // Inject Access Token
    if (window.AnimePlusAuth && window.AnimePlusAuth.accessToken) {
      config.headers = {
        ...config.headers,
        "Authorization": `Bearer ${window.AnimePlusAuth.accessToken}`
      };
    }

    let response = await originalFetch(resource, config);

    if (response.status === 401 && !resource.toString().includes("/api/auth/login") && !resource.toString().includes("/api/auth/refresh") && !resource.toString().includes("/api/auth/register")) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await originalFetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include"
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            window.AnimePlusAuth.accessToken = data.accessToken;
            isRefreshing = false;
            onRefreshed(data.accessToken);
            config.headers = { ...config.headers, "Authorization": `Bearer ${data.accessToken}` };
            return originalFetch(resource, config);
          } else {
            // Refresh failed (token expired/invalid) - log out
            window.AnimePlusAuth.accessToken = null;
            localStorage.setItem("isLoggedIn", "false");
            isRefreshing = false;
            onRefreshed(null);
            // Only redirect if on a page that strictly requires authentication
            if (window.location.pathname.includes("profile.html") || window.location.pathname.includes("edit-profile.html")) {
              window.location.href = "home.html";
            }
            return response; 
          }
        } catch (err) {
          isRefreshing = false;
          onRefreshed(null);
          return response;
        }
      } else {
        // Wait for refresh
        return new Promise((resolve) => {
          refreshSubscribers.push((token) => {
            if (token) {
              config.headers = { ...config.headers, "Authorization": `Bearer ${token}` };
              resolve(originalFetch(resource, config));
            } else {
              resolve(response);
            }
          });
        });
      }
    }

    return response;
  };
  // ---------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    // --- OAUTH REDIRECT & ERROR HANDLING ---
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");
    const tokenParam = urlParams.get("token");

    if (tokenParam) {
      // User successfully logged in via OAuth
      window.AnimePlusAuth.accessToken = tokenParam;
      localStorage.setItem("isLoggedIn", "true");
      // Clean URL immediately without reloading the page
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (errorParam) {
      setTimeout(() => {
        if (errorParam === "oauth_failed") {
          window.AnimePlusAuth.showToast("Google Login Failed", "error");
        } else if (errorParam === "oauth_error") {
          window.AnimePlusAuth.showToast("An error occurred during Google Login", "error");
        }
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 500);
    }
    // ----------------------------

    const style = document.createElement('style');
    style.textContent = `
      #toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .toast {
        background: #333;
        color: #fff;
        padding: 12px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transform: translateX(120%);
        transition: transform 0.3s ease-in-out;
        font-family: inherit;
      }
      .toast.show {
        transform: translateX(0);
      }
      .toast-error { border-left: 4px solid #ff4d4d; }
      .toast-success { border-left: 4px solid #4dff88; }
      #logoutBtn {
        background: none;
        border: none;
        color: #ff4d4d;
        cursor: pointer;
        font-size: 14px;
        margin-left: 10px;
        padding: 5px 10px;
        border-radius: 4px;
        transition: background 0.2s;
      }
      #logoutBtn:hover {
        background: rgba(255, 77, 77, 0.1);
      }
      .password-wrapper {
        position: relative;
        width: 100%;
        display: block;
      }
      .password-wrapper input {
        width: 100%;
        padding-right: 40px !important; 
        margin-bottom: 0 !important; 
      }
      .password-wrapper .toggle-eye {
        position: absolute;
        right: 15px;
        top: 50%;
        transform: translateY(-50%);
        color: #aaa;
        cursor: pointer;
        transition: color 0.2s;
        font-size: 16px;
      }
      .password-wrapper .toggle-eye:hover {
        color: #ac4a92;
      }
      #loginform #inputs > .password-wrapper, #sign > .password-wrapper {
        margin-bottom: 15px;
      }
    `;
    document.head.appendChild(style);

    const loginForm = document.getElementById("loginform");
    const signupForm = document.getElementById("signupform");

    function enhanceInputs() {
      if (loginForm) {
        const inputs = loginForm.querySelectorAll("input");
        if (inputs[0]) inputs[0].placeholder = "Email Address";
        if (inputs[1]) {
          inputs[1].placeholder = "Password";
          wrapPasswordInput(inputs[1]);
        }
      }

      if (signupForm) {
        const inputs = signupForm.querySelectorAll("input");
        if (inputs[0]) inputs[0].placeholder = "Username";
        if (inputs[1]) inputs[1].placeholder = "Email Address";
        if (inputs[2]) {
          inputs[2].placeholder = "Password";
          wrapPasswordInput(inputs[2]);
        }
        if (inputs[3]) {
          inputs[3].placeholder = "Confirm Password";
          wrapPasswordInput(inputs[3]);
        }
      }

      // Hook up Google Login
      const googleIcons = document.querySelectorAll(".fa-google");
      googleIcons.forEach(icon => {
        const link = icon.closest("a");
        if (link) {
          link.href = "/api/auth/google";
        }
      });
    }

    function wrapPasswordInput(inputEl) {
      if (!inputEl || inputEl.parentNode.classList.contains("password-wrapper")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "password-wrapper";
      
      inputEl.parentNode.insertBefore(wrapper, inputEl);
      wrapper.appendChild(inputEl);

      const eyeIcon = document.createElement("i");
      eyeIcon.className = "fa-solid fa-eye-slash toggle-eye"; // Initial hidden state
      wrapper.appendChild(eyeIcon);

      eyeIcon.addEventListener("click", () => {
        if (inputEl.type === "password") {
          inputEl.type = "text";
          eyeIcon.classList.remove("fa-eye-slash");
          eyeIcon.classList.add("fa-eye");
        } else {
          inputEl.type = "password";
          eyeIcon.classList.remove("fa-eye");
          eyeIcon.classList.add("fa-eye-slash");
        }
      });
    }

    enhanceInputs();
    
    const loginBtnWrapper = document.getElementById("login-and-search");
    const loginBtn = loginBtnWrapper ? loginBtnWrapper.querySelector("button") : null;
    const profileSection = document.getElementById("profile");

    async function loadCurrentUser() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        
        if (data.user) {
          localStorage.setItem("isLoggedIn", "true");
          document.documentElement.classList.remove("logged-out");
          document.documentElement.classList.add("logged-in");
          
          window.AnimePlusAuth.currentUser = data.user;
          window.AnimePlusAuth.updateNavbarLoggedIn(data.user);
        } else {
          localStorage.setItem("isLoggedIn", "false");
          document.documentElement.classList.remove("logged-in");
          document.documentElement.classList.add("logged-out");
          
          window.AnimePlusAuth.currentUser = null;
          window.AnimePlusAuth.updateNavbarLoggedOut();
        }
      } catch (err) {
        console.error("Failed to load user session", err);
        if (window.AnimePlusAuth.updateNavbarLoggedOut) window.AnimePlusAuth.updateNavbarLoggedOut();
      } finally {
        window.AnimePlusAuth.isAuthLoaded = true;
      }
    }

    window.AnimePlusAuth.updateNavbarLoggedIn = function(user) {
      if (loginBtn) {
        loginBtn.style.display = "none";
        loginBtn.style.visibility = "visible"; // Reset visibility just in case
      }
      
      if (profileSection) {
        profileSection.style.display = "flex";
        // Make profile section clickable to route to profile page
        profileSection.style.cursor = "pointer";
        profileSection.onclick = () => window.location.href = "profile.html";
        
        const userLabel = profileSection.querySelector("label");
        if (userLabel) userLabel.textContent = user.username;
        
        const existingIcon = profileSection.querySelector("#userIcon");
        if (existingIcon && user.avatar) {
          if (existingIcon.tagName.toLowerCase() === 'i') {
            const img = document.createElement("img");
            img.src = user.avatar;
            img.id = "userIcon";
            img.alt = user.username ? `${user.username} Avatar` : "User Avatar";
            img.style.width = "40px";
            img.style.height = "40px";
            img.style.borderRadius = "50%";
            img.style.objectFit = "cover";
            img.style.marginRight = "10px";
            existingIcon.replaceWith(img);
          } else if (existingIcon.tagName.toLowerCase() === 'img') {
            existingIcon.src = user.avatar;
          }
        }
      }
    };

    window.AnimePlusAuth.updateNavbarLoggedOut = function() {
      if (loginBtn) {
        loginBtn.style.display = "block";
        loginBtn.style.visibility = "visible";
      }
      
      if (profileSection) {
        profileSection.style.display = "none";
        const label = profileSection.querySelector("label");
        if (label) label.textContent = "Guest";
        
        const img = profileSection.querySelector("img#userIcon");
        if (img) {
          const icon = document.createElement("i");
          icon.className = "bi bi-person-circle";
          icon.id = "userIcon";
          img.replaceWith(icon);
        }
      }  
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) logoutBtn.remove();
    };

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const inputs = loginForm.querySelectorAll("input");
        const email = inputs[0].value;
        const password = inputs[1].value;

        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();

          if (res.ok) {
            window.AnimePlusAuth.accessToken = data.accessToken;
            window.AnimePlusAuth.showToast("Logged in successfully!", "success");
            localStorage.setItem("isLoggedIn", "true");
            document.documentElement.classList.remove("logged-out");
            document.documentElement.classList.add("logged-in");
            
            document.getElementById("loginModal").style.display = "none";
            loginForm.reset();
            
            loginForm.querySelectorAll(".toggle-eye").forEach(eye => {
              eye.classList.remove("fa-eye");
              eye.classList.add("fa-eye-slash");
            });
            loginForm.querySelectorAll('input[type="text"]').forEach(inp => {
              if (inp.placeholder.includes("Password")) inp.type = "password";
            });

            await loadCurrentUser();
          } else {
            window.AnimePlusAuth.showToast(data.error || "Login failed", "error");
          }
        } catch (err) {
          window.AnimePlusAuth.showToast("Network error. Server might be restarting.", "error");
        }
      });
    }

    if (signupForm) {
      signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const inputs = signupForm.querySelectorAll("input");
        const username = inputs[0].value;
        const email = inputs[1].value;
        const password = inputs[2].value;
        const confirmPassword = inputs[3].value;

        try {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password, confirmPassword })
          });
          const data = await res.json();

          if (res.ok) {
            window.AnimePlusAuth.accessToken = data.accessToken;
            window.AnimePlusAuth.showToast("Account created successfully!", "success");
            localStorage.setItem("isLoggedIn", "true");
            document.documentElement.classList.remove("logged-out");
            document.documentElement.classList.add("logged-in");
            
            document.getElementById("loginModal").style.display = "none";
            signupForm.reset();
            
            signupForm.querySelectorAll(".toggle-eye").forEach(eye => {
              eye.classList.remove("fa-eye");
              eye.classList.add("fa-eye-slash");
            });
            signupForm.querySelectorAll('input[type="text"]').forEach(inp => {
              if (inp.placeholder.includes("Password")) inp.type = "password";
            });

            await loadCurrentUser();
          } else {
            window.AnimePlusAuth.showToast(data.error || "Signup failed", "error");
          }
        } catch (err) {
          window.AnimePlusAuth.showToast("Network error. Server might be restarting.", "error");
        }
      });
    }

    function addSidebarLogo() {
      const menuContent = document.getElementById("menuContent");
      if (!menuContent) return;
      
      const existingLogo = document.getElementById("sidebarLogo");
      if (existingLogo) return;

      const logoContainer = document.createElement("div");
      logoContainer.id = "sidebarLogo";
      logoContainer.style.textAlign = "center";
      logoContainer.style.marginTop = "auto";
      logoContainer.style.padding = "20px 10px";
      
      const logoImg = document.createElement("img");
      logoImg.src = "../assets/images/لقطة_شاشة_2025-06-14_185723-removebg-preview.png";
      logoImg.alt = "Sidebar Logo";
      logoImg.style.width = "120px";
      logoImg.style.opacity = "0.8";
      logoImg.style.filter = "drop-shadow(0 0 10px rgba(172, 74, 146, 0.3))";
      
      logoContainer.appendChild(logoImg);
      
      const lists = document.getElementById("lists");
      if (lists) {
        lists.appendChild(logoContainer);
      } else {
        menuContent.appendChild(logoContainer);
      }
    }

    function setupForgotPassword() {
      const forgotLink = document.getElementById("forgotPasswordLink");
      const modalContent = document.querySelector(".modal-content");
      const itemsContainer = document.getElementById("items");
      
      if (!forgotLink || !modalContent) return;
      
      forgotLink.addEventListener("click", (e) => {
        e.preventDefault();
        
        // Hide login form and items
        if (loginForm) loginForm.style.display = "none";
        if (itemsContainer) itemsContainer.style.display = "none";
        
        let forgotForm = document.getElementById("forgotform");
        if (!forgotForm) {
          forgotForm = document.createElement("form");
          forgotForm.id = "forgotform";
          forgotForm.style.display = "block"; // override default none
          forgotForm.innerHTML = `
            <span class="close">&times;</span>
            <img src="../assets/images/لقطة_شاشة_2025-06-14_185723-removebg-preview.png" alt="Logo" />
            <h3 style="color:white; margin-bottom:10px; font-size: 24px; font-weight: bold;">Forgot Password</h3>
            <div id="forgot-inputs" style="margin-bottom: 15px; text-align: left;">
              <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin-top: 0; margin-bottom: 15px; text-align: center;">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <input type="email" placeholder="Email Address" required style="width:100%; border-radius:12px; padding:14px 20px; outline:none; border:1px solid rgba(172, 74, 146, 0.3); background:rgba(255,255,255,0.05); color:white; font-size:16px;">
            </div>
            <button type="submit">Send Reset Link</button>
            <a href="#" id="gotologin" style="display:block; font-size:14px; color:#ac4a92; text-decoration:none; margin-top:15px; text-align:center;">Back to Login</a>
          `;
          
          modalContent.appendChild(forgotForm);
          
          // Setup event handlers
          forgotForm.querySelector(".close").addEventListener("click", () => {
            const modal = document.getElementById("loginModal");
            if (modal) modal.style.display = "none";
          });
          
          forgotForm.querySelector("#gotologin").addEventListener("click", (e) => {
            e.preventDefault();
            forgotForm.style.display = "none";
            if (loginForm) loginForm.style.display = "block";
            if (itemsContainer) itemsContainer.style.display = "block";
          });
          
          forgotForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const emailInput = forgotForm.querySelector("input[type='email']");
            const submitBtn = forgotForm.querySelector("button");
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
            
            try {
              const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailInput.value })
              });
              const data = await res.json();
              
              if (res.ok) {
                window.AnimePlusAuth.showToast(data.message || "Reset email sent successfully!", "success");
                forgotForm.style.display = "none";
                if (loginForm) loginForm.style.display = "block";
                if (itemsContainer) itemsContainer.style.display = "block";
                forgotForm.reset();
              } else {
                window.AnimePlusAuth.showToast(data.error || "Failed to request password reset", "error");
              }
            } catch (err) {
              window.AnimePlusAuth.showToast("Network error. Please try again.", "error");
            } finally {
              submitBtn.disabled = false;
              submitBtn.innerHTML = "Send Reset Link";
            }
          });
        } else {
          forgotForm.style.display = "block";
        }
      });
    }

    function checkShowLoginQuery() {
      const showLogin = urlParams.get("showLogin");
      if (showLogin === "true") {
        setTimeout(() => {
          window.AnimePlusAuth.openLoginModal();
          window.history.replaceState({}, document.title, window.location.pathname);
        }, 300);
      }
    }

    addSidebarLogo();
    setupForgotPassword();
    checkShowLoginQuery();
    loadCurrentUser();
  });
}
