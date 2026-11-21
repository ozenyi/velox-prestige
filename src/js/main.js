(function () {
  const config = window.VELOX_CONFIG || { waitlistEndpoint: "", provider: "none" };

  const nav = document.querySelector(".nav");
  const burger = document.querySelector(".nav-burger");
  const panel = document.getElementById("nav-panel");

  if (nav && burger && panel) {
    const closeMenu = () => {
      nav.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Ouvrir le menu");
      document.body.classList.remove("menu-open");
    };
    const openMenu = () => {
      nav.classList.add("is-open");
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Fermer le menu");
      document.body.classList.add("menu-open");
      const first = panel.querySelector("a");
      if (first) first.focus();
    };
    burger.addEventListener("click", () => {
      if (nav.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
    panel.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        closeMenu();
        burger.focus();
      }
    });
  }

  const search = document.querySelector("[data-search]");
  if (search) {
    const note = document.getElementById("recherche-note");
    const field = search.querySelector("input");
    const show = (example) => {
      if (example && field) field.value = example;
      if (note) {
        note.hidden = false;
        note.textContent = example
          ? "« " + example + " » est un exemple. La recherche en langage naturel sera disponible au lancement : aucune annonce n'est consultée."
          : "La recherche en langage naturel sera disponible au lancement. Aucune annonce n'est consultée.";
      }
    };
    search.addEventListener("submit", (event) => {
      event.preventDefault();
      show(field && field.value.trim());
    });
    search.querySelectorAll("[data-example]").forEach((chip) => {
      chip.addEventListener("click", () => show(chip.getAttribute("data-example") || ""));
    });
  }

  const tabs = document.querySelector("[data-tabs]");
  if (tabs) {
    const buttons = Array.from(tabs.querySelectorAll("[role='tab']"));
    const panels = buttons.map((button) => document.getElementById(button.getAttribute("aria-controls")));
    const select = (index, focus) => {
      buttons.forEach((button, i) => {
        const on = i === index;
        button.setAttribute("aria-selected", on ? "true" : "false");
        button.tabIndex = on ? 0 : -1;
        if (panels[i]) panels[i].hidden = !on;
      });
      if (focus) buttons[index].focus();
    };
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(index, false));
      button.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const next = event.key === "ArrowRight" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
        select(next, true);
      });
    });
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("parcours");
    if (wanted === "particulier") select(1, false);
    else select(0, false);
    const interest = params.get("interet");
    const recherche = document.getElementById("p-recherche");
    if (interest && recherche && !recherche.value) {
      recherche.value = "Je souhaite être informé des annonces de la catégorie : " + interest + ".";
      select(1, false);
    }
  }

  document.querySelectorAll("[data-waitlist]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = form.querySelector("[data-status]");
      clearErrors(form);
      const honeypot = form.querySelector("[data-honeypot]");
      if (honeypot && honeypot.value.trim()) {
        setStatus(status, "error", "Le champ anti-spam doit rester vide. Rien n'a été envoyé.");
        return;
      }
      const errors = validate(form);
      if (errors.length) {
        errors.forEach(({ field, message }) => showError(field, message));
        errors[0].field.focus();
        setStatus(status, "error", "Le formulaire est incomplet. Rien n'a été envoyé.");
        return;
      }
      if (!config.waitlistEndpoint) {
        setStatus(
          status,
          "pending",
          "Les inscriptions ouvrent très bientôt. Aucune donnée n'a été envoyée."
        );
        return;
      }
      const payload = collect(form);
      const button = form.querySelector("[type='submit']");
      if (button) button.disabled = true;
      try {
        await send(config, payload);
        form.reset();
        setStatus(
          status,
          "ok",
          config.provider === "apps-script"
            ? "Votre demande a été transmise. Si l'adresse du script est correcte, elle est enregistrée dans le tableur du responsable. En cas de doute, utilisez l'adresse des mentions légales."
            : "Merci. Votre demande est enregistrée. Nous vous écrirons pour le lancement, et seulement pour cela."
        );
      } catch (error) {
        setStatus(status, "error", "L'envoi n'a pas abouti. Rien n'a été confirmé : vous pouvez réessayer.");
        if (button) button.disabled = false;
      }
    });
  });

  function validate(form) {
    const errors = [];
    form.querySelectorAll("input, textarea, select").forEach((field) => {
      if (field.hasAttribute("data-honeypot") || field.disabled) return;
      const value = field.value.trim();
      if (field.required && !value) {
        errors.push({ field, message: "Ce champ est nécessaire." });
        return;
      }
      if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push({ field, message: "Indiquez une adresse e-mail valide." });
      }
      if (field.type === "tel" && value && value.replace(/\D/g, "").length < 8) {
        errors.push({ field, message: "Le numéro semble incomplet." });
      }
      if (field.type === "checkbox" && field.required && !field.checked) {
        errors.push({ field, message: "Le consentement est nécessaire pour être informé du lancement." });
      }
    });
    return errors;
  }

  function collect(form) {
    const data = { parcours: form.getAttribute("data-parcours") || "", consentement: true, source: "velox-prestige" };
    form.querySelectorAll("input, textarea, select").forEach((field) => {
      if (!field.name || field.hasAttribute("data-honeypot") || field.type === "checkbox") return;
      data[field.name] = field.value.trim();
    });
    return data;
  }

  async function send(current, payload) {
    if (current.provider === "apps-script") {
      await fetch(current.waitlistEndpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      return;
    }
    const response = await fetch(current.waitlistEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
  }

  function showError(field, message) {
    field.setAttribute("aria-invalid", "true");
    const id = field.id + "-error";
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement("p");
      node.id = id;
      node.className = "field-error";
      field.insertAdjacentElement("afterend", node);
    }
    node.textContent = message;
    const described = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    described.add(id);
    field.setAttribute("aria-describedby", Array.from(described).join(" "));
  }

  function clearErrors(form) {
    form.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
    form.querySelectorAll(".field-error").forEach((node) => node.remove());
  }

  function setStatus(node, state, message) {
    if (!node) return;
    node.hidden = false;
    node.dataset.state = state;
    node.textContent = message;
  }
})();
