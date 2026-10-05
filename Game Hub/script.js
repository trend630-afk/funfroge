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