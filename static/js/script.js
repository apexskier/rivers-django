$(function(){

    var methodMap = {
        'create': 'POST',
        'update': 'PUT',
        'patch': 'PATCH',
        'delete': 'DELETE',
        'read': 'GET'
    };

    Backbone.emulateJSON = true;

    var options = {
        filetype: "json", // "csv" or "json"
    }

    /*----------------------*
     *   Helper Functions   |
     *----------------------*/
    var utils = {
        groupByDay: function(collection) {
            return _.groupBy(collection, function(e) {
                return e.time.start.isoWeekday();
            });
        },
    }

    /*------------*
     |   Models   |
     *------------*/
    var Gauge = Backbone.Model.extend({
        initialize: function() {
        }
    });
    var State = Backbone.Model.extend({

    });
    var Favorite = Backbone.Model.extend();

    /*-----------------*
     |   Collections   |
     *-----------------*/
    var AppCollection = Backbone.Collection.extend({
    });
    var Gauges = AppCollection.extend({
        url: "json/jobs.json",
        model: Job,
    });
    var States = AppCollection.extend({
        url: "http://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=wa&outputDataTypeCd=iv&siteStatus=active&hasDataTypeCd=iv",
    });
    var Favorites = AppCollection.extend({
        url: "json/people.json",
        model: Person,
    });

    /*-----------*
     |   Views   |
     *-----------*/
    // container view
    var AppView = Backbone.View.extend({
        el: $("body"),
        events: {
            "click #show_events": "show_events",
            "click #show_overview": "show_overview",
            "click #to_nav": "scroll_down",
            "click #to_top": "scroll_up",
        },
        initialize: function() {
            this.render();
        },
        render: function() {
            this.$('#main').text('Nothing has loaded yet...');
            return this;
        },
    });

    // empty state - essentially a 404
    var EmptyState = Backbone.View.extend({
        render: function() {
            data = location.hash.split('/');
            if (data.length == 2) {
                // this can happen if a user, job, or event isn't found.
                // It'll direct to the main page for the 'type' it thinks you're looking for.
                this.$el.html("<h3>Can't find the <a href='" + data[0] + "'>" + data[0] + "</a> " + data[1].replace('-', ' ') + ".</h3>");
            } else {
                this.$el.html("<h3>Only emptiness here</h3>");
            }
            return this;
        }
    });

    /*------------*
     |   Router   |
     *------------*/
    var AppRouter = Backbone.Router.extend({
        initialize: function() {
            this.currentView = null;
        },
        routes: {
            "":                 "index",
            "*anything":        "empty",
        },
        index: function() {
        },
        all_events: function() {
            this.swapView(new AllEventsView({collection: all_events}));
        },
        one_event: function(id) {
            this.swapDetailView(all_events, EventView, {'id': parseInt(id)})
        },
        remove_slash: function() {
            this.navigate(location.hash.slice(0, -1), {trigger: true});
        },
        swapView: function(view) {
            // if a view exists, remove it from the dom and stop event handlers
            if (this.currentView) {
                this.currentView.remove();
            }
            this.currentView = view;
            // put the new view's content into the #content element after it's rendered
            $('#content').html(this.currentView.render().el);

            // scroll to the top of the page
            var duration = $('body').scrollTop() * 0.6;
            $('body').animate({
                scrollTop: 0
            }, duration);

            // any new elements need their tooltips started
            $('.tooltip-trigger').tooltip();
        },
        swapDetailView: function(collection, view, attrs) {
            var m = collection.findWhere(attrs);
            if (m) {
                this.swapView(new view({ model: m }));
            } else {
                this.swapView(new EmptyState({'view': view}));
            }
        },
        empty: function() {
            this.swapView(new EmptyState());
        }
    });

    /*------------------------------------------*
     |   Global Vars, Collections, and Router   |
     *------------------------------------------*/
    var all_events = new Events;
    var all_jobs = new Jobs;
    var all_people = new People;
    var appRouter = new AppRouter;

    /*--------------------------*
     |   Start things moving!   |
     *--------------------------*/
    // get all resources before anything starts
    var e_req = all_events.fetch();
    var j_req = all_jobs.fetch();
    var p_req = all_people.fetch();
    $.when(e_req, j_req, p_req).done(function() {
        // App!
        var App = new AppView;

        $('.tooltip-trigger').tooltip();

        // Start router and navigation
        Backbone.history.start();
    });
    // identify scrolling as a user action and stops the animation
    $(document).on("scroll mousedown DOMMouseScroll mousewheel keyup", function(e){
        if ( e.which > 0 || e.type === "mousedown" || e.type === "mousewheel") {
             $(document).stop();
        }
    });

});
