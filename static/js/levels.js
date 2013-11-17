$(function(){
    var AppModel = Backbone.Model.extend({
    });
    var SimpleGauge = AppModel.extend({
        urlRoot: "/api/v1/simplegauge",
    });
    var Gauge = AppModel.extend({
        urlRoot: '/api/v1/gauge',
    });

    var AppCollection = Backbone.Collection.extend({
        parse: function(response) {
            this.recent_meta = response.meta || {};
            return response.objects || response;
        },
    });
    var SimpleGaugeList = AppCollection.extend({
        model: SimpleGauge,
        url: "/api/v1/simplegauge/?limit=0",
    });
    var GaugeList = AppCollection.extend({
        model: Gauge,
    })

    var AppView = Backbone.View.extend({
        el: '#main',
        events: {
            'click #list': 'showAll',
        },
        initialize: function() {
        },
        showAll: function() {
            router.navigate('', {trigger: true});
        }
    });
    var ListView = Backbone.View.extend({
        tagName: 'ul',
        className: 'list-unstyled',
        attributes: {
            'id': 'list'
        },
        initialize: function() {
        },
        render: function() {
            this.$el.html('<h3>All gauges</h3>');
            MasterGaugeList.each(function(gauge) {
                this.$el.append(new SimpleGaugeListView({model: gauge}).render().el);
            }, this);
            return this;
        }
    });
    var SimpleGaugeListView = Backbone.View.extend({
        tagName: "li",
        className: "simplegauge",
        template: _.template($('#simple-gauge-list-template').html()),
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'destroy', this.remove);
        },
        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        },
    });
    var GaugeDetailView = Backbone.View.extend({
        template: _.template($('#gauge-detail-view').html()),
        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        },
        postRender: function() {
            var width = _.max($.map($('.graph'), function(graph_div) {
                    return $(graph_div).innerWidth() || 1;
                })),
                height = _.max($.map($('.graph'), function(graph_div) {
                    return $(graph_div).innerHeight() || 1;
            }));
            width = width > 600 ? width : 600;

            var margin = {
                top: 10,
                right: 20,
                bottom: 40,
                left:50
            }

            _.each(this.model.get('data'), function(g_data, i) {
                g_data.values = g_data.values.filter(function(el, i) {
                    return i % 4 == 0 ? true : false;
                });

                g_data.values.forEach(function(d) {
                    d[0] = new Date(d[0]);
                    d[1] = +d[1];
                });

                var decodedUnit = function(str) {
                    var el = $('<div />').html(str).text();
                    return el;
                }

                var x = d3.time.scale().range([0, width - margin.left - margin.right]);
                var y;
                var yAxis;
                if (g_data.unit == "cfs" || g_data.unit == "ft3/s") {
                    y = d3.scale.log().range([height - margin.top - margin.bottom, 0]);
                    yAxis = d3.svg.axis().scale(y).orient('left').tickFormat(d3.format("d"));
                } else {
                    y = d3.scale.linear().range([height - margin.top - margin.bottom, 0]);
                    yAxis = d3.svg.axis().scale(y).orient('left');
                }
                var xAxis = d3.svg.axis().scale(x).orient('bottom');
                var line = d3.svg.line()
                    .interpolate('basis')
                    .x(function(d) { return x(d[0]); })
                    .y(function(d) { return y(d[1]); });
                var line_null = d3.svg.line()
                    .interpolate('basis')
                    .x(function(d) { return x(d[0]); })
                    .y(function(d) { return height - margin.bottom });
                var area_null = d3.svg.area()
                    .interpolate('basis')
                    .x(function(d) { return x(d[0]); })
                    .y0(height - margin.bottom)
                    .y1(function(d) { return height - margin.bottom; });
                var area = d3.svg.area()
                    .interpolate('basis')
                    .x(function(d) { return x(d[0]) })
                    .y0(height - margin.top - margin.bottom)
                    .y1(function(d) { return y(d[1]) });
                var svg = d3.select('#graph_' + i).append('svg')
                    .attr('width', width).attr('height', height - margin.top)
                    .append('g')
                        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

                x.domain(d3.extent(g_data.values, function(d) { return d[0] }));
                y.domain(d3.extent(g_data.values, function(d) { return d[1] }));

                svg.append('g')
                    .attr('class', 'x axis')
                    .attr('transform', 'translate(0,' + (height - margin.top - margin.bottom) + ')')
                    .call(xAxis);

                svg.append('g')
                    .attr('class', 'y axis')
                    .attr('y', margin.top)
                    .call(yAxis)
                svg.append('g')
                    .attr('class', 'y grid')
                    .attr('y', margin.top)
                    .call(yAxis.orient('right').tickFormat('').tickSize(width - margin.left - margin.right));
                svg.select("g.y.grid").selectAll(".tick")
                    .style('opacity', 0.4)
                    .filter(function(d, i){ return d3.select(this).classed('minor');} )
                        .style('opacity', 0.1);

                var duration = 1000;
                var area_path = svg.append('path')
                    .datum(g_data.values)
                    .attr('class', 'area')
                    .attr('d', area_null)
                    .transition()
                        .duration(duration)
                        .attr('d', area);
                /*var line = svg.append('path')
                    .datum(g_data.values)
                    .attr('class', 'line')
                    .attr('d', line);
                    .transition()
                        .duration(duration)
                        .attr('d', line)*/

            }, this);
            return this;
        }
    })

    var AppRouter = Backbone.Router.extend({
        initialize: function() {
            this.currentView = null;
        },
        routes: {
            "":                 "index",
            "detail/:id":       "detail",
            "*anything":        "empty",
        },
        index: function() {
            this.swapView(ListView, {collection: MasterGaugeList});
        },
        detail: function(id) {
            var that = this;
            var model = FullGaugeList.get(id);
            if (model) {
                this.swapView(GaugeDetailView, {model: model});
            } else {
                FullGaugeList.add({id: id}).get(id).fetch({success: function() {
                    that.detail(id);
                }});
            }
        },
        remove_slash: function() {
            this.navigate(location.hash.slice(0, -1), {trigger: true});
        },
        swapView: function(view, options) {
            options = options || null;
            // if a view exists, remove it from the dom and stop event handlers
            $('#loading').html('<h2>Loading...</h2>');
            if (this.currentView) {
                this.currentView.remove();
            }
            this.currentView = new view(options);
            // put the new view's content into the #content element after it's rendered
            $('#content').html(this.currentView.render().el);
            if (typeof this.currentView.postRender == "function") {
                this.currentView.postRender();
            }
        },
        empty: function() {
            this.swapView(EmptyState());
        }
    });

    var MasterGaugeList = new SimpleGaugeList();
    var FullGaugeList = new GaugeList();
    var router = new AppRouter();

    var gauge_req = MasterGaugeList.fetch();
    $.when(gauge_req).done(function() {
        // App!
        var App = new AppView;

        // Start router and navigation
        Backbone.history.start();
    });
});
