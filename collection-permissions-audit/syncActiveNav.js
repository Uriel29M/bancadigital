  function syncActiveNav() {
    const navSection = { comic: "comics", collection: "collections" }[state.section] || state.section;
    $$(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.section === navSection));
  }

