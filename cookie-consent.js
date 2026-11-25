
(() => {
    "use strict";

    const GA_ID = "G-54RHV9042V";
    const CONSENT_KEY = "funfroge_cookie_consent";

    function loadAnalytics() {
        if (window.funfrogeAnalyticsLoaded) return;
        window.funfrogeAnalyticsLoaded = true;

        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
            window.dataLayer.push(arguments);
        };

        window.gtag("js", new Date());
        window.gtag("config", GA_ID);

        const script = document.createElement("script");
        script.async = true;
        script.src =
            "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
        document.head.appendChild(script);
    }

    function getPrivacyUrl() {
        const path = decodeURIComponent(window.location.pathname);
        const parts = path.split("/").filter(Boolean);

        if (parts.length <= 1) {
            return "Game%20Hub/privacy.html";
        }

        if (parts[parts.length - 2] === "Game Hub") {
            return "privacy.html";
        }

        return "../Game%20Hub/privacy.html";
    }

    function saveChoice(choice) {
        localStorage.setItem(CONSENT_KEY, choice);
        banner.style.display = "none";

        if (choice === "accepted") {
            loadAnalytics();
        }
    }

    const savedChoice = localStorage.getItem(CONSENT_KEY);

    if (savedChoice === "accepted") {
        loadAnalytics();
    }

    const style = document.createElement("style");
    style.textContent = `
        #funfroge-cookie-banner {
            position: fixed;
            left: 16px;
            right: 16px;
            bottom: 16px;
            z-index: 99999;
            max-width: 680px;
            margin: auto;
            padding: 20px;
            color: #f5f7fb;
            background: #101923;
            border: 1px solid #344456;
            border-radius: 14px;
            box-shadow: 0 10px 35px rgba(0,0,0,.4);
            font: 14px/1.6 Arial, sans-serif;
        }

        #funfroge-cookie-banner p {
            margin: 8px 0 16px;
        }

        #funfroge-cookie-banner a {
            color: #71d9ff;
        }

        .funfroge-cookie-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .funfroge-cookie-actions button,
        #funfroge-cookie-settings {
            padding: 10px 16px;
            border: 1px solid #526579;
            border-radius: 8px;
            background: #1c2a39;
            color: white;
            cursor: pointer;
            font-weight: bold;
        }

        .funfroge-cookie-actions button:first-child {
            background: #147ca3;
            border-color: #147ca3;
        }

        #funfroge-cookie-settings {
            position: fixed;
            bottom: 12px;
            right: 12px;
            z-index: 99998;
            font-size: 12px;
            padding: 8px 12px;
        }

        @media (max-width: 480px) {
            #funfroge-cookie-banner {
                left: 10px;
                right: 10px;
                bottom: 10px;
                padding: 16px;
            }

            .funfroge-cookie-actions button {
                flex: 1;
            }
        }
    `;
    document.head.appendChild(style);

    const banner = document.createElement("div");
    banner.id = "funfroge-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookie preferences");

    banner.innerHTML = `
        <strong>Privacy and cookie choices</strong>
        <p>
            FunFroge Games uses essential browser storage for game
            features. With your permission, Google Analytics helps
            us understand website visits. You can accept or reject
            analytics. Read our
            <a href="${getPrivacyUrl()}">Privacy Policy</a>.
        </p>
        <div class="funfroge-cookie-actions">
            <button type="button" id="funfroge-accept">
                Accept analytics
            </button>
            <button type="button" id="funfroge-reject">
                Reject analytics
            </button>
        </div>
    `;

    document.body.appendChild(banner);

    document.getElementById("funfroge-accept").addEventListener(
        "click",
        () => saveChoice("accepted")
    );

    document.getElementById("funfroge-reject").addEventListener(
        "click",
        () => saveChoice("rejected")
    );

    const settings = document.createElement("button");
    settings.id = "funfroge-cookie-settings";
    settings.type = "button";
    settings.textContent = "Cookie settings";

    settings.addEventListener("click", () => {
        banner.style.display = "block";
    });

    document.body.appendChild(settings);

    if (savedChoice === "accepted" || savedChoice === "rejected") {
        banner.style.display = "none";
    }
})();
