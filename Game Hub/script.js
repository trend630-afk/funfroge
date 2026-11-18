const pageSections = document.querySelectorAll("[data-nav-section]");
const sectionLinks = document.querySelectorAll('.main-nav a[href^="#"], .footer-nav a[href^="#"]');
const gameCards = Array.from(document.querySelectorAll(".game-card"));
const gameSearch = document.querySelector("#gameSearch");
const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
const gameCount = document.querySelector("#gameCount");
const noGamesMessage = document.querySelector("#noGamesMessage");
let selectedCategory = "all";

function filterGames() {
	const searchTerm = gameSearch.value.trim().toLowerCase();
	let visibleCount = 0;

	gameCards.forEach((card) => {
		const categories = card.dataset.categories.split(" ");
		const matchesCategory = selectedCategory === "all" || categories.includes(selectedCategory);
		const matchesSearch = card.textContent.toLowerCase().includes(searchTerm);
		const isVisible = matchesCategory && matchesSearch;
		card.hidden = !isVisible;
		if (isVisible) visibleCount += 1;
	});

	const totalCount = gameCards.length;
	gameCount.textContent = visibleCount === totalCount
		? `${totalCount} Games Available`
		: `${visibleCount} of ${totalCount} Games Available`;
	noGamesMessage.hidden = visibleCount !== 0;
}

filterButtons.forEach((button) => {
	button.addEventListener("click", () => {
		selectedCategory = button.dataset.filter;
		filterButtons.forEach((filterButton) => {
			filterButton.setAttribute("aria-pressed", String(filterButton === button));
		});
		filterGames();
	});
});

gameSearch.addEventListener("input", filterGames);
filterGames();

if ("IntersectionObserver" in window) {
	const sectionObserver = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;

			const currentLocation = `#${entry.target.id}`;
			sectionLinks.forEach((link) => {
				if (link.hash === currentLocation) {
					link.setAttribute("aria-current", "location");
				} else {
					link.removeAttribute("aria-current");
				}
			});
		});
	}, { rootMargin: "-25% 0px -60% 0px" });

	pageSections.forEach((section) => sectionObserver.observe(section));
}

/* FUNFROGE — 3D ARCADE CARD MOVEMENT */

if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".game-card").forEach((card) => {
        card.addEventListener("mousemove", (event) => {
            const rect = card.getBoundingClientRect();

            const x = (event.clientX - rect.left) / rect.width;
            const y = (event.clientY - rect.top) / rect.height;

            const rotateY = (x - 0.5) * 12;
            const rotateX = (0.5 - y) * 12;

            card.style.setProperty("--tilt-x", `${rotateX}deg`);
            card.style.setProperty("--tilt-y", `${rotateY}deg`);
            card.classList.add("is-tilting");
        });

        card.addEventListener("mouseleave", () => {
            card.classList.remove("is-tilting");
            card.style.removeProperty("--tilt-x");
            card.style.removeProperty("--tilt-y");
        });
    });
}

/* FUNFROGE — PLAYER PROFILE SYSTEM */

(() => {
    const nameInput = document.querySelector("#playerName");
    const avatarChoice = document.querySelector("#playerAvatarChoice");
    const saveButton = document.querySelector("#saveProfile");
    const profileName = document.querySelector("#profileName");
    const profileAvatar = document.querySelector("#profileAvatar");
    const profileMessage = document.querySelector("#profileMessage");

    if (!nameInput || !avatarChoice || !saveButton) return;

    const STORAGE_KEY = "funfrogePlayerProfile";

    function loadProfile() {
        try {
            const savedProfile = JSON.parse(
                localStorage.getItem(STORAGE_KEY)
            );

            if (!savedProfile) return;

            const validAvatars = ["🎮", "👾", "🚀", "🦊", "🐸", "🤖"];

            const name = typeof savedProfile.name === "string"
                ? savedProfile.name.slice(0, 18)
                : "";

            const avatar = validAvatars.includes(savedProfile.avatar)
                ? savedProfile.avatar
                : "🎮";

            nameInput.value = name;
            avatarChoice.value = avatar;
           profileName.textContent = name || "Guest Player";
profileAvatar.textContent = avatar;

profileMessage.textContent = name
    ? "Welcome back, " + name + "! Your profile is saved on this device."
    : "Create your player profile.";
        } catch (error) {
            console.warn("Could not load player profile:", error);
        }
    }

    saveButton.addEventListener("click", () => {
        const name = nameInput.value.trim();
        const avatar = avatarChoice.value;

        if (!name) {
            profileMessage.textContent = "Please enter a nickname first.";
            nameInput.focus();
            return;
        }

        const profile = { name, avatar };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

            profileName.textContent = name;
            profileAvatar.textContent = avatar;
            profileMessage.textContent = "Profile saved successfully!";
        } catch (error) {
            profileMessage.textContent = "Could not save profile in this browser.";
            console.warn("Could not save player profile:", error);
        }
    });

    loadProfile();
})();
