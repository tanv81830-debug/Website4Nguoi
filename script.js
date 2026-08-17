document.addEventListener("DOMContentLoaded", function () {

    // Hiệu ứng xuất hiện khi cuộn trang
    const elements = document.querySelectorAll(
        ".member, .welcome, .home-section, .member-profile"
    );

    const observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("show");
                }
            });
        },
        {
            threshold: 0.12
        }
    );

    elements.forEach(function (element) {
        element.classList.add("fade-in");
        observer.observe(element);
    });


    // Hiệu ứng xác nhận khi quay lại danh sách
    const backButtons = document.querySelectorAll(
        'a[href="../hs.html"]'
    );

    backButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            sessionStorage.setItem("returnToStudents", "true");
        });
    });


    // Tự động đánh dấu trang hiện tại trên menu
    const currentPage = window.location.pathname.split("/").pop();

    document.querySelectorAll(".nav-menu a").forEach(function (link) {
        const linkPage = link.getAttribute("href").split("/").pop();

        if (linkPage === currentPage) {
            link.classList.add("active");
        }
    });

});