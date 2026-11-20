/* FUNFROGE — SHARED PLAYER STATISTICS */

window.updateFunFrogeStats = function (eventType, details = {}) {
    const storageKey = "funfrogeArcadeStats";

    try {
        const stats = JSON.parse(
            localStorage.getItem(storageKey) || "{}"
        );

        stats.gamesPlayed = Number(stats.gamesPlayed) || 0;
        stats.gamesCompleted = Number(stats.gamesCompleted) || 0;
        stats.games = stats.games || {};
        stats.recentActivity = stats.recentActivity || [];

        const gameKey = details.game || "unknown";

        if (!stats.games[gameKey]) {
            stats.games[gameKey] = {
                plays: 0,
                completions: 0,
                bestScore: 0
            };
        }

        const game = stats.games[gameKey];

        if (eventType === "started") {
            stats.gamesPlayed++;
            game.plays++;
        }

        if (eventType === "completed") {
            stats.gamesCompleted++;
            game.completions++;
            game.bestScore = Math.max(
                game.bestScore,
                Number(details.score) || 0
            );
        }

        stats.recentActivity.unshift({
            game: gameKey,
            event: eventType,
            score: Number(details.score) || 0,
            date: new Date().toISOString()
        });

        stats.recentActivity = stats.recentActivity.slice(0, 20);

        localStorage.setItem(storageKey, JSON.stringify(stats));

    } catch (error) {
        console.warn("FunFroge statistics error:", error);
    }
};