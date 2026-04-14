(function () {
    function getView() {
        if (!window.PageVisualView) {
            throw new Error("PageVisualView is not initialized");
        }
        return window.PageVisualView;
    }

    async function bootPageDemo(jsonPath) {
        const view = getView();
        try {
            const response = await fetch(jsonPath, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const config = await response.json();
            view.renderDemo(config);
        } catch (error) {
            view.renderError(
                "Lỗi tải dữ liệu",
                "Không đọc được JSON"
            );
            console.error(error);
        }
    }

    function bootLivePageDemo() {
        const view = getView();
        view.renderLiveDemo();
    }

    window.PageVisualController = {
        bootPageDemo,
        bootLivePageDemo,
    };

    window.bootPageDemo = bootPageDemo;
    window.bootLivePageDemo = bootLivePageDemo;
})();
