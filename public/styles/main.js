$(".expander").click(function() {
    if ($(this).hasClass("expander")) {
        $(this).removeClass("expander");
    }
    else {
         $(this).addClass("expander");
    }
});