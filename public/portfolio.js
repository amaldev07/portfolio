document.documentElement.classList.add("js");

const menuButton = document.querySelector(".menu-toggle");
const navigation = document.getElementById("primary-navigation");

function closeMenu(returnFocus = false) {
  navigation.classList.remove("is-open");
  menuButton.setAttribute("aria-expanded", "false");
  if (returnFocus) menuButton.focus();
}

menuButton.addEventListener("click", () => {
  const open = navigation.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(open));
});
navigation.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  closeMenu();
  // Keep keyboard focus at the destination after the mobile menu closes.
  const destination = document.querySelector(link.hash);
  if (destination) {
    destination.setAttribute("tabindex", "-1");
    destination.focus({ preventScroll: true });
  }
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) closeMenu();
});
window
  .matchMedia("(min-width: 1101px)")
  .addEventListener("change", () => closeMenu());

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        navigation.querySelectorAll("a").forEach((link) => {
          if (link.hash === `#${entry.target.id}`)
            link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }
    },
    { rootMargin: "-15% 0px -65% 0px", threshold: 0 },
  );
  document
    .querySelectorAll("main > section")
    .forEach((section) => observer.observe(section));
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Good Night";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}
document.getElementById("greeting-message").textContent = getGreeting();

const toggle = document.getElementById("ai-chatbot-toggle");
const widget = document.getElementById("ai-chatbot-widget");
const close = document.getElementById("ai-chatbot-close");
const form = document.getElementById("ai-chatbot-form");
const input = document.getElementById("ai-chatbot-input");
const messages = document.getElementById("ai-chatbot-messages");

function setChatOpen(open) {
  widget.classList.toggle("hidden", !open);
  toggle.setAttribute("aria-expanded", String(open));
  (open ? input : toggle).focus();
}

toggle.addEventListener("click", () =>
  setChatOpen(widget.classList.contains("hidden")),
);
close.addEventListener("click", () => setChatOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!widget.classList.contains("hidden")) setChatOpen(false);
  else if (navigation.classList.contains("is-open")) closeMenu(true);
});

function addMessage(label, text, reply = false) {
  const message = document.createElement("div");
  message.className = reply ? "chat-message reply" : "chat-message";
  const speaker = document.createElement("b");
  speaker.textContent = `${label}: `;
  message.append(speaker, document.createTextNode(text));
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const userMessage = input.value.trim();
  if (!userMessage) return;
  addMessage("You", userMessage);
  input.value = "";
  let reply =
    "Sorry, I can only answer basic questions like contact details, skill sets etc of Amaldev right now.";
  if (/\b(hello|hi|hey)\b/i.test(userMessage))
    reply = "Hello! How can I help you today?";
  else if (/your name/i.test(userMessage))
    reply = "I'm an AI assistant for Amaldev";
  else if (/skills|expertise/i.test(userMessage))
    reply =
      "Amaldev specializes in Angular, React, TypeScript, and modern frontend engineering.";
  else if (/contact|email|phone/i.test(userMessage))
    reply =
      "You can contact Amaldev at Email:amaldev.psn@gmail.com. Phone:+91-7594072480";
  else if (/blog|articles/i.test(userMessage))
    reply = "Check out the latest blogs on Amaldev's Medium profile!";
  else if (/portfolio|projects/i.test(userMessage))
    reply = "Visit the Projects section to see Amaldev's work!";
  else if (/experience|work/i.test(userMessage))
    reply = "Amaldev has over 10 years of experience in frontend development.";
  else if (/tools|technologies/i.test(userMessage))
    reply = "Amaldev uses Angular, React, TypeScript, Tailwind CSS, and more.";
  else if (/project|portfolio/i.test(userMessage))
    reply = "Check out the Projects and Blogs sections for Amaldev's work!";
  setTimeout(() => addMessage("AI", reply, true), 400);
});
