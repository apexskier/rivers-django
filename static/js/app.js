/*
 * Main js code for Rivers app
 */

/**
 * TODO
 * - implement error callbacks for failed fetches of collection - error: function(collection, response, options)
 * - rewrite map icon and polyline system
 * - resource loading system, for cancelling and managing requests
 */

var test;
var map = new L.map('map');
var $map_status = $('#status');
var $content = $('#content');
var ratings = ['-', 'I', 'I+', 'II', 'II+', 'III', 'III+', 'IV', 'IV+', 'V', 'V+', 'Unrunnable'];

$.fn.serializeObject = function() {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};
window.addEventListener('load', function() {
    new FastClick(document.body);
}, false);
function setStatus(text) {
    console.log(text);
}

/**
 * Models
 */
window.AppModel = Backbone.Model.extend({
    base_url: function() {
        var temp_url = Backbone.Model.prototype.url.call(this);
        console.log(temp_url);
        return (temp_url.charAt(temp_url.length - 1) == '/' ? temp_url : temp_url+'/');
    },
    url: function() {
        console.log(this.base_url());
        return this.base_url();
    },
    validate: function() {
        console.log('validating model');
        this.unset('pub_user');
        this.unset('pub_date');
    },
    onCreate: function(model, xhr) {
        console.log("success");
        console.log(model);
        console.log(xhr);
        return this;
    },
    postRender: function() {
        return this;
    },
    selectRivers: function() {
        var return_val = '<label name="river">River</label><select name="river">';
        var that = this;
        riverList.forEach(function(model, index, array) {
            return_val += '<option value="' + model.get('id') + '"';
            if (model.get('id') == that.get('river').id) {
                return_val += ' selected';
            }
            return_val += ' ">' + model.get('name') + '</option>';
        });
        return_val += '</select>';
        return return_val;
    },
    removeCallbacks: function() {
        return this;
    }
});
window.MapMarkerModel = window.AppModel.extend({
    initialize: function() {
        if (!!this.get('geo_lat') && !this.mapItem) {
            this.markerOptions['title'] = this.get('name');
            this.mapItem = new L.Marker([this.get('geo_lat'), this.get('geo_lng')], this.markerOptions);
            console.log(this.get('name'));
            //console.log(this.markerOptions['icon'].options.iconUrl);
            this.mapItem.on('click', function() {
                app.navigate(this.short_name + '/' + this.get('id'));
                app.switchView(new ModalView({model: this}));
            }, this);
            if (this.collection) {
                this.collection.mapGroup.addLayer(this.mapItem); // TODO this should be integrated with the MapView if possible, and events should be with a view as well.
            }
        }
        return this.render();
    },
    render: function() {
        return this;
    },
    markerOptions: {},
    template: function(action) {
        switch (action) {
            case 'details':
                return this.detailsTemplate();
            case 'edit':
                return '<h3>Edit {{name}}</h3><form id="form">' + this.editTemplate() +
                '<button type="submit" class="btn btn-primary submit">Submit</button> ' +
                '<a href="#" class="btn cancel">Cancel</a>';
            case 'add':
                return this.addTemplate();
        }
    },
    latLngPicker: function() {
        var return_val = '<label name="geo_lat">Latitude</label>' +
            '<input type="number" name="geo_lat" id="lat" class="lat" min="-90" max="90" step=".0000000001" required ' +
            'value="' + this.get('geo_lat') + '">' +
            '<label name="geo_lng">Longitude</label>' +
            '<input type="number" name="geo_lng" id="lng" class="lng" min="-180" max="180" step=".0000000001" required ' +
            'value="' + this.get('geo_lng') + '">' +
            '<span class="help-block">Drag the marker\'s icon to change the location.</span>';
        var that = this;
        this.mapItem.dragging.enable();
        this.mapItem.on('move', function(e) {
            that.latVal = Math.round(e.latlng.lat * Math.pow(10, 10)) / Math.pow(10, 10);
            that.lngVal = Math.round(e.latlng.lng * Math.pow(10, 10)) / Math.pow(10, 10);
            $("#lat").val(that.latVal);
            $("#lng").val(that.lngVal);
        });
        map.on('click', function(e) {
            that.latVal = e.latlng.lat;
            that.lngVal = e.latlng.lng;
            that.mapItem.setLatLng([that.latVal, that.lngVal]);
        });
        return return_val;
    },
});
var River = AppModel.extend({
    url: '/api/v1/river/',
    short_name: 'river',
    template: function() {
        var r_id = this.get('id');
        var return_val = '<h3>{{name}}</h3><div id="gauges"><p>Loading gauges...</p></div><div id="markers"><p>Loading markers...</p></div><div id="rapids"><p>Loading rapids...</p></div><div id="runs"><p>Loading runs...</p></div>';

        return return_val;
    },
    runs_loaded: false,
});
var Gauge = MapMarkerModel.extend({
    url: '/api/v1/gauge/',
    short_name: 'gauge',
    render: function() {
        this.on('change', this.updateRunColor(), this);
        this.updateRunColor();
    },
    updateRunColor: function() {
        console.log('gauge change');
        runs = runList.where({gauge: this.get('resource_uri')});
        _.each(runs, function(run) {
            console.log('coloring ' + run.get('name'));
            var flow_units = this.get('flow_units');
            var max_flow = run.get('max_level');
            var min_flow = run.get('min_level');
            var current_flow;
            _.each(this.get('data'), function(item) {
                if (item.unit == flow_units) {
                    current_flow = item.recent;
                }
            });
            console.log(current_flow);
            if (current_flow > min_flow && current_flow < max_flow) {
                // try to calculate this on a logarithmic scale, might not do this
                var hue = Math.log(current_flow - min_flow) * 140 / Math.log(max_flow - min_flow);
                run.mapItem.setStyle({color: 'hsl(' + hue + ', 100%, 50%)'});
            } else if (current_flow <= min_flow) {
                run.mapItem.setStyle({color: 'hsl(0, 100%, 50%)'});
                console.log('low');
            } else if (current_flow >= max_flow) {
                run.mapItem.setStyle({color: 'hsl(240, 100%, 50%)'});
                console.log('high');
            }
        }, this);
    },
    markerOptions: {
        'icon': L.icon({
            iconUrl: 'static/img/icons/gauge.png',
            iconRetinaUrl: 'static/img/icons/gauge@2x.png',
            iconSize: [32, 29],
            iconAnchor: [16, 15],
        })
    },
    detailsTemplate: function() {
        return '<button type="button" class="edit">Edit</button><h3>{{name}}</h3>' +
        '<p class="meta"><a href="#/river/{{river.id}}">{{river.name}} River</a>' +
        '<p><a target="_blank" href="{{link}}">{{link}}</a></p>' +
        '<div id="graphs"></div>';
    },
    editTemplate: function() {
        return '<label name="gauge_id">ID</label><input type="text" name="gauge_id" required value="{{gauge_id}}" />' +
            this.selectTypes() +
            this.selectUnits() +
            this.selectRivers() +
            this.latLngPicker() +
            '<label name="description">Description</label><textarea name="description">{{description}}</textarea>'
    },
    selectTypes: function() {
        var return_val = '<label name="gauge_type">Type</label><select name="gauge_type">';
        return_val += '<option value="USGS"';
        if (this.get('gauge_type') == "USGS") {
            return_val += ' selected';
        }
        return_val += '>United States Geological Survey (USGS)</option>';
        return_val += '<option value="WADOE"'
        if (this.get('gauge_type') == "WADOE") {
            return_val += ' selected';
        }
        return_val += '>Washington State Deparment of Ecology (fortress.wa.gov)</option>';
        return_val += '</select>';
        return return_val;
    },
    selectUnits: function() {
        var return_val = '<label name="flow_units">Units</label><select name="flow_units">';
        return_val += '<option value="cfs"';
        if (this.get('flow_units') == "cfs") {
            return_val += ' selected';
        }
        return_val += '>cfs</option>';
        return_val += '<option value="ft"'
        if (this.get('flow_units') == "ft") {
            return_val += ' selected';
        }
        return_val += '>feet</option>';
        return_val += '<option value="m"'
        if (this.get('flow_units') == "m") {
            return_val += ' selected';
        }
        return_val += '>meters</option>';
        return_val += '</select>';
        return return_val;
    },
    postRender: function() {
        var g_datas = this.get('data');
        var flow_units = this.get('flow_units');
        // generate each graph
        for (var g in g_datas) {
            var g_data = g_datas[g];
            id_clean = g_data.unit.replace(/\s+/g, '-');
            if (g_data.unit == flow_units) {
                $('#graphs').prepend('<div id="' + id_clean + '"></div>');
                var trend_desc = "stable";
                if (g_data.trend > 0) {
                    trend_desc = "rising";
                } else if (g_data.trend < 0) {
                    trend_desc = "falling";
                }
                $('#content .meta').append(' - currently ' + g_data.recent + ' ' + g_data.unit + ' and ' + trend_desc);
            } else {
                $('#graphs').append('<div id="' + id_clean + '"></div>');
            }
            var y_type = 'linear';
            if (g_data.unit == "cfs") {
                y_type = 'logarithmic';
            }
            var clean_unitname = $('<div />').html(g_data.unitName).text();
            $('#graphs #' + id_clean).highcharts({
                chart: {
                    type: 'line',
                    height: 250,
                    zoomType: 'x'
                },
                title: {
                    text: g_data.unitDesc,
                    style: {
                        fontFamily: 'Lato, sans-serif',
                    }
                },
                tooltip: {
                    borderRadius: 2,
                    followTouchMove: true,
                    headerFormat: '<span style="font-size: 10px">{point.key}</span><br/>',
                    valueSuffix: ' ' + g_data.unit
                },
                legend: {
                    enabled: false
                },
                xAxis: {
                    type: 'datetime',
                    dateTimeLabelFormats: {
                        millisecond: '%H:%M:%S.%L',
                        second: '%H:%M:%S',
                        minute: '%b %e, %H:%M',
                        hour: '%b %e, %H',
                        day: '%b %e',
                        week: '%b %e',
                        month: '%b \'%y',
                        year: '%Y'
                    }
                },
                yAxis: {
                    title: {
                        text: clean_unitname,
                        style: {
                            fontFamily: 'Lato, sans-serif',
                            fontWeight: '500'
                        }
                    },
                    type: y_type,
                    plotLines: [{
                        value: 0,
                        width: 1,
                        color: '#808080'
                    }]
                },
                series: [{
                    data: g_data.values,
                    marker: {
                        enabled: false
                    },
                    name: 'Value',
                    pointInterval: 2 * 60 * 60
                }]
            });
        }
        return this;
    },
    removeCallbacks: function() {
        this.mapItem.setLatLng([this.get('geo_lat'), this.get('geo_lng')]).dragging.disable();
        return this;
    }
});
var MarkerType = AppModel.extend({
    url: '/api/v1/markertype/',
    short_name: 'marker type',
});
var Marker = MapMarkerModel.extend({
    url: '/api/v1/marker/',
    short_name: 'marker',
    markerOptions: {
        'icon': L.icon({
            iconUrl: 'static/img/icons/river_access.png',
            iconRetinaUrl: 'static/img/icons/river_access@2x.png',
            iconSize: [28, 22],
            iconAnchor: [14, 11],
        })
    },
    detailsTemplate: function() {
        return '<button type="button" class="edit">Edit</button><h3>{{name}}</h3><p class="meta">' +
            '<a href="#/river/{{river.id}}">{{river.name}} River</a> - {{marker_type.name}}</p>' +
            '<p>{{description}}</p>';
    },
    editTemplate: function() {
        return '<label name="name">Name</label><input type="text" name="name" value="{{name}}" />' +
            this.selectMarkerTypes() +
            this.selectRivers() +
            this.latLngPicker() +
            '<label name="description">Description</label><textarea name="description">{{description}}</textarea>'
    },
    selectMarkerTypes: function() {
        var return_val = '<label name="marker_type">Type</label><select name="marker_type">';
        var that = this;
        markerTypeList.forEach(function(model, index, array) {
            return_val += '<option value="' + model.get('id') + '"';
            if (model.get('id') == that.get('marker_type').id) {
                return_val += ' selected';
            }
            return_val += ' ">' + model.get('name') + '</option>';
        });
        return_val += '</select>';
        return return_val;
    },
    removeCallbacks: function() {
        this.mapItem.setLatLng([this.get('geo_lat'), this.get('geo_lng')]).dragging.disable();
        return this;
    }
});
var Rapid = MapMarkerModel.extend({
    url: '/api/v1/rapid/',
    short_name: 'rapid',
    initialize: function() {
        this.setIcon();
        this.markerOptions['title'] = this.get('name');
        this.mapItem = new L.Marker([this.get('geo_lat'), this.get('geo_lng')], this.markerOptions);
        console.log(this.get('name'));
        //console.log(this.markerOptions['icon'].options.iconUrl);
        this.mapItem.on('click', function() {
            app.navigate(this.short_name + '/' + this.get('id'));
            app.switchView(new ModalView({model: this}));
        }, this);
        if (this.collection) {
            this.collection.mapGroup.addLayer(this.mapItem); // TODO this should be integrated with the MapView if possible, and events should be with a view as well.
        }
    },
    setIcon: function() {
        var icon = 'static/img/icons/rapid';
        var size = [34, 29];
        var anchor = [17, 14];
        switch (parseInt(this.get('rating'))) {
            case 1:
                icon += 'I';
                break;
            case 2:
                icon += 'Iplus';
                size = [34, 33];
                anchor = [17, 16];
                break;
            case 3:
                icon += 'II';
                size = [34, 33];
                anchor = [17, 16];
                break;
            case 4:
                icon += 'IIplus';
                size = [34, 37];
                anchor = [17, 18];
                break;
            case 5:
                icon += 'III';
                size = [34, 37];
                anchor = [17, 18];
                break;
            case 6:
                icon += 'IIIplus';
                size = [34, 41];
                anchor = [17, 20];
                break;
            case 7:
                icon += 'IV';
                size = [34, 41];
                anchor = [17, 20];
                break;
            case 8:
                icon += 'IVplus';
                size = [34, 45];
                anchor = [17, 22];
                break;
            case 9:
                icon += 'V';
                size = [34, 45];
                anchor = [17, 22];
                break;
            case 10:
                icon += 'V+';
                size = [34, 49];
                anchor = [17, 24];
                break;
            case 11:
                icon += 'VI';
                size = [34, 43];
                anchor = [17, 21];
                break;
            default:
                break;
        }
        this.markerOptions['icon'] = L.icon({
            iconUrl: icon + '.png',
            iconRetinaUrl: icon + '@2x.png',
            iconSize: size,
            iconAnchor: anchor
        });
        console.log(icon);
    },
    detailsTemplate: function() {
        return '<button type="button" class="edit">Edit</button><h3>{{name}}</h3>' +
            '<p class="meta"><a href="#/river/{{river.id}}">{{river.name}} River</a> - Class ' + ratings[this.get('rating')] + '</p>' +
            '<p>{{description}}</p>';
    },
    editTemplate: function() {
        return '<label name="name">Name</label><input type="text" name="name" value="{{name}}" />' +
            this.selectRivers() +
            this.latLngPicker() +
            //'<label name="rating">Class</label>' +
            //'<div id="rating" class="noUiSlider"></div><p class="rating-val help-block">Slide to select class.</p>' +
            '<label name="description">Description</label><textarea name="description">{{description}}</textarea>'
    },
    validate: function(attrs, options) {
        if (attrs.name == "" | !attrs.name) {
            return "A name is required.";
        }
    },
    removeCallbacks: function() {
        this.mapItem.setLatLng([this.get('geo_lat'), this.get('geo_lng')]).dragging.disable();
        return this;
    }
});
var Run = MapMarkerModel.extend({
    url: '/api/v1/run/',
    short_name: 'run',
    initialize: function() {
        setStatus('displaying ' + this.get('name') + ' run');
        var gauge_uri = this.get('gauge');
        var myGauge = gaugeList.find(function(item) {
            return item.get('resource_uri') === gauge_uri;
        });
        var runColor = 'black';
        if (myGauge) {
            runColor = 'red';
        }

        var that = this;
        console.log("creating gpx");
        this.mapItem = new L.GPX(this.get('gpx_file'), {
            async: true,
            color: 'black',
            weight: 15,
            smoothFactor: 2,
            opacity: 0.75,
        }).on({'click': function() {
            app.navigate(that.short_name + '/' + that.get('id'));
            app.switchView(new ModalView({model: that}));
        }, 'mouseover': function(e) {
            this.setStyle({opacity: 0.9});
        }, 'mouseout': function(e) {
            this.setStyle({opacity: 0.75});
        }, 'loaded': function(e) {
            var distance = 0.000621371 * e.target.get_distance();
            var elevation_data = e.target.get_elevation_data();
            var elevation_loss = elevation_data[0][1] - elevation_data[elevation_data.length - 1][1];
            that.set('gpx_data', {
                'distance': Math.round(distance * 100) / 100,
                'elevation_loss': Math.round(elevation_loss),
                'gradient': Math.round(elevation_loss / distance),
                'elevation_data': elevation_data
            });
        }});
        if (this.collection) {
            this.collection.mapGroup.addLayer(this.mapItem); // TODO this should be integrated with the MapView if possible, and events should be with a view as well.
        }
    },
    detailsTemplate: function() {
        return '<button type="button" class="edit">Edit</button><h3>{{name}}</h3>' +
        '<p class="meta"><a href="#/river/{{river.id}}">{{river.name}} River</a> - Class ' +
        ratings[this.get('min_rating')] + '/' + ratings[this.get('max_rating')] +
        this.get_gauge_details() + '</p>' +
        '<p>Distance: {{gpx_data.distance}} miles, Gradient: {{gpx_data.gradient}} ft/m</p>' +
        '<div id="elevationgraph"></div><p>{{description}}</p>';
    },
    editTemplate: function() {
        return '<h3>Edit {{name}}</h3>';
    },
    get_gauge_details: function() {
        var gauge_uri = this.get('gauge');
        var run_gauge = gaugeList.find(function(item) {
            return item.get('resource_uri') === gauge_uri;
        });
        if (run_gauge) {
            var max_flow = this.get('max_level');
            var min_flow = this.get('min_level');
            var ret = ', in from ';
            var current_flow;
            var flow_units = run_gauge.get('flow_units');
            _.each(run_gauge.get('data'), function(item) {
                if (item.unit == flow_units) {
                    current_flow = item.recent;
                }
            });
            if (flow_units == 'cfs') {
                max_flow = Math.round(max_flow);
                min_flow = Math.round(min_flow);
            }
            ret += min_flow + ' to ' + max_flow + ' ' + flow_units + ', ' + 'currently ' + current_flow +
                ', on the <a href="#/gauge/' + run_gauge.get('id') + '">' + run_gauge.get('name') + ' gauge</a>';
            return ret;
        } else {
            return '';
        }
    },
    postRender: function() {
        var elevation_data = this.get('gpx_data').elevation_data;
        var r_distance = [];
        var r_elevation = [];
        var r_combined = [];

        for (var i = 128; i < elevation_data.length - 128; i += 16) {
            var avg_distance = 0;
            for (j = -64; j < 64; j++) {
                avg_distance += elevation_data[i - j][0];
            }
            avg_distance /= 128;
            r_distance.push(Math.round(0.621371 * 100 * avg_distance) / 100);
            var avg_elevation = 0;
            for (j = -64; j < 64; j++) {
                avg_elevation += elevation_data[i - j][1];
            }
            avg_elevation /= 128;
            r_elevation.push(Math.round(3.28084 * avg_elevation));
            r_combined.push([Math.round(0.621371 * 100 * avg_distance) / 100, Math.round(3.28084 * avg_elevation)]);
        }
        $('#elevationgraph').highcharts({
            chart: {
                type: 'line',
                height: 250,
                zoomType: 'x'
            },
            title: {
                text: 'Elevation over Distance',
                style: {
                    fontFamily: 'Lato, sans-serif',
                }
            },
            tooltip: {
                borderRadius: 2,
                followTouchMove: true,
                headerFormat: '<span style="font-size: 10px">{point.key} miles</span><br/>',
                valueDecimals: 0,
                valueSuffix: ' ft'
            },
            legend: {
                enabled: false
            },
            xAxis: {
                min: r_distance[0],
                max: r_distance[r_distance.length - 1],
                title: {
                    text: 'Distance (miles)',
                    style: {
                        fontFamily: 'Lato, sans-serif',
                        fontWeight: '500'
                    }
                }
            },
            yAxis: {
                title: {
                    text: 'Elevation (ft)',
                    style: {
                        fontFamily: 'Lato, sans-serif',
                        fontWeight: '500'
                    }
                },
                plotLines: [{
                    value: 0,
                    width: 1,
                    color: '#808080'
                }]
            },
            series: [{
                data: r_combined,
                marker: {
                    enabled: false
                },
                name: 'Elevation'
            }]
        });
    },
});

/**
 * Collections
 */
window.AppCollection = Backbone.Collection.extend({
    parse: function(response) {
        this.recent_meta = response.meta || {};
        return response.objects || response;
    },
    postRenderAdd: function() {
        return this;
    },
});
window.MapCollection = AppCollection.extend({
    initialize: function() {
        this.mapGroup = new L.layerGroup();
        return this;
    },
});
window.RiverCollection = AppCollection.extend({
    model: River,
    url: "api/v1/river/?limit=0",
    comparator: function(model) {
        return model.get('name');
    },
    addTemplate: function(viewContext) {
        return '<h3>Add new river</h3>' + viewContext.name;
    },
});
window.GaugeCollection = MapCollection.extend({
    model: Gauge,
    url: "api/v1/gauge/?limit=0",
    addTemplate: function(viewContext) {
        return '<h3>Add new gauge</h3>' +
            '<label name="gauge_id">ID</label>' +
            '<input type="text" name="gauge_id" required />' +
            '<label name="gauge_type">Type</label>' +
            '<select name="gauge_type" requried>' +
                '<option value="USGS">United States Geological Survey (USGS)</option>' +
                '<option value="WADOE">Washington State Deparment of Ecology (fortress.wa.gov)</option>' +
            '</select>' +
            '<label name="flow_units">Units</label>' +
            '<select name="flow_units" required>' +
                '<option value="cfs">cfs</option>' +
                '<option value="ft">feet</option>' +
                '<option value="m">meters</option>' +
            '</select>' +
            viewContext.selectRivers() +
            viewContext.latLngPicker();
    },
    postRenderAdd: function(viewContext) {
        $("#lat").bind("propertychange keyup input paste", function(e) {
            if (viewContext.latVal != $(this).val()) {
                viewContext.latVal = $(this).val();
                if (viewContext.lngVal != "" && viewContext.lngVal != null) {
                    viewContext.centerMarker.setLatLng([viewContext.latVal, viewContext.lngVal]);
                    map.panTo([viewContext.latVal, viewContext.lngVal]);
                }
            }
        });
        $("#lng").bind("propertychange keyup input paste", function(e) {
            if (viewContext.lngVal != $(this).val()) {
                viewContext.lngVal = $(this).val();
                if (viewContext.latVal != "" && viewContext.latVal != null) {
                    viewContext.centerMarker.setLatLng([viewContext.latVal, viewContext.lngVal]);
                    map.panTo([viewContext.latVal, viewContext.lngVal]);
                }
            }
        });
    },
});
window.MarkerTypeCollection = AppCollection.extend({
    model: MarkerType,
    url: "api/v1/markertype/?limit=0",
    addTemplate: function(viewContext) {
        return '<h3>Add new marker type</h3>' + viewContext.name;
    },
});
window.MarkerCollection = MapCollection.extend({
    model: Marker,
    url: "api/v1/marker/?limit=0",
    initialize: function() {
        this.mapGroup = new L.layerGroup();
        var that = this;
        /*
        this.on('add', function(model) {
            var r_id = model.get('river').id;
            if (that.gaugeRequest & that.request_r_id == r_id) {
                that.gaugeRequest.abort();
                that.runRequest.abort();
            }
            that.request_r_id = r_id;
            that.gaugeRequest = gaugeList.fetch({data: {river: r_id}, remove: false});
            that.runRequest = runList.fetch({data: {river: r_id}, remove: false});
        });*/
        return this;
    },
    addTemplate: function(viewContext) {
        return '<h3>Add new marker</h3>' + viewContext.name +
            this.selectMarkerTypes() +
            viewContext.selectRivers() +
            viewContext.latLngPicker() +
            viewContext.description;
    },
    selectMarkerTypes: function() {
        var return_val = '<label name="marker_type">Type</label><select name="marker_type">';
        markerTypeList.forEach(function(element, index, array) {
            return_val += '<option value="' + element.attributes.id + '">';
            return_val += element.attributes.name;
            return_val += '</option>';
        });
        return_val += '</select>';
        return return_val;
    },
    postRenderAdd: function(viewContext) {
        $("#lat").bind("propertychange keyup input paste", function(e) {
            if (viewContext.latVal != $(this).val()) {
                viewContext.latVal = $(this).val();
                if (viewContext.lngVal != "" && viewContext.lngVal != null) {
                    viewContext.centerMarker.setLatLng([viewContext.latVal, viewContext.lngVal]);
                    map.panTo([viewContext.latVal, viewContext.lngVal]);
                }
            }
        });
        $("#lng").bind("propertychange keyup input paste", function(e) {
            if (viewContext.lngVal != $(this).val()) {
                viewContext.lngVal = $(this).val();
                if (viewContext.latVal != "" && viewContext.latVal != null) {
                    viewContext.centerMarker.setLatLng([viewContext.latVal, viewContext.lngVal]);
                    map.panTo([viewContext.latVal, viewContext.lngVal]);
                }
            }
        });
    },
});
window.RapidCollection = MapCollection.extend({
    model: Rapid,
    url: "api/v1/rapid/?limit=0",
    addTemplate: function(viewContext) {
        return '<h3>Add new rapid</h3>' + viewContext.name +
            viewContext.selectRivers() +
            viewContext.latLngPicker() +
            '<label name="rating">Class</label>' +
            '<div id="rating" class="noUiSlider"></div><p class="rating-val help-block">Slide to select class.</p>' +
            viewContext.description;
    },
    postRenderAdd: function(viewContext) {
        $("#lat").bind("propertychange keyup input paste", function(e) {
            if (viewContext.latVal != $(this).val()) {
                viewContext.latVal = $(this).val();
                if (viewContext.lngVal != "" && viewContext.lngVal != null) {
                    viewContext.centerMarker.setLatLng([viewContext.latVal, viewContext.lngVal]);
                    map.panTo([viewContext.latVal, viewContext.lngVal]);
                }
            }
        });
        $("#lng").bind("propertychange keyup input paste", function(e) {
            if (viewContext.lngVal != $(this).val()) {
                viewContext.lngVal = $(this).val();
                if (viewContext.latVal != "" && viewContext.latVal != null) {
                    viewContext.centerMarker.setLatLng([viewContext.latVal, viewContext.lngVal]);
                    map.panTo([viewContext.latVal, viewContext.lngVal]);
                }
            }
        });
        $('#rating').noUiSlider({
            serialization: {
                to: ["rating"],
                resolution: 1
            },
            range: [0, 11],
            start: 6,
            step: 1,
            handles: 1,
            slide: function() {
                $(this).attr('name', 'rating');
                var value = $(this).val();
                $('.rating-val').text(ratings[value]);
            }
        });
    },
});
window.RunCollection = MapCollection.extend({
    model: Run,
    url: "api/v1/run/?limit=0",
    addTemplate: function(viewContext) {
        return '<h3>Add new rapid</h3>' + viewContext.name +
            viewContext.selectRivers() +
            '<label name="rating">Class</label>' +
            '<div id="rating" class="noUiSlider"></div><p class="rating-val help-block">Slide to select class.</p>' +
            /*'<label name="gauge">Gauge</label>' +
            '<div id="run-gauge"></div><input type="hidden" name="gauge" required />' +
            '<p class="help-block">Click on a gauge on the map to select it.</p>' +*/
            this.selectGauges() +
            '<label name="min_level">Minimum level</label>' +
            '<input type="number" name="min_level" />' +
            '<label name="max_level">Maximum level</label>' +
            '<input type="number" name="max_level" />' +
            '<label name="gpx_file">GPX File</label>' +
            '<input type="file" name="gpx_file" />' +
            viewContext.description;
    },
    postRenderAdd: function(viewContext) {
        $('#rating').noUiSlider({
            serialization: {
                to: ["min_rating", "max_rating"],
                resolution: 1
            },
            range: [0, 11],
            start: [5, 6],
            step: 1,
            handles: 2,
            slide: function() {
                var values = $(this).val();
                $('.rating-val').text(ratings[values[0]] + "/" + ratings[values[1]]);
            }
        });
    },
    selectGauges: function() {
        var return_val = '<label name="gauge">Gauge</label><select name="gauge">';
        gaugeList.forEach(function(element, index, array) {
            return_val += '<option value="' + element.attributes.id + '">';
            return_val += element.attributes.name;
            return_val += '</option>';
        });
        return_val += '</select>';
        return return_val;
    },
}); /* I want to load all runs from a river when a marker or rapid or gauge from that river has been loaded */

/**
 * Views
 */
// map view
window.MapView = Backbone.View.extend({
    el: '#map',
    tile: {},
    initialize: function() {
        setStatus('setting up map');
        var that = this;
        var at = ' Created by <a href="http://camlittle.com">Cameron Little</a> — ';
        /* various map tiles */
        this.tile.osm_landscape = new L.TileLayer('http://{s}.tile3.opencyclemap.org/landscape/{z}/{x}/{y}.png', {
            attribution: at + 'Map data © OpenStreetMap contributors, tiles by <a href="http://thunderforest.com/landscape/" target="_blank">Thunderforest</a>',
            detectRetina: true
        });
        this.tile.mq_sat = new L.TileLayer('http://otile4.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg', {
            attribution: at + 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">',
            detectRetina: true
        });
        this.tile.stamin_tonerlite = new L.TileLayer('http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.jpg', {
            attribution: at + '<a target="_blank" href="http://maps.stamen.com/">Map tiles</a> by <a target="_blank" href="http://stamen.com">Stamen Design</a>, under <a target="_blank" href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a target="_blank" href="http://openstreetmap.org">OpenStreetMap</a>, under <a target="_blank" href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.',
            detectRetina: true,
        });

        riverList.fetch();

        /* map actions */
        map.locate({setView: false, maxZoom: 14});
        this.render();
    },
    render: function() {
        /* viewable stuff */
        setStatus('rendering map');
        map.addLayer(this.tile.osm_landscape);

        runList.mapGroup.addTo(map);
        gaugeList.mapGroup.addTo(map);
        this.zoom_layer_vis();

        var baseMaps = {
            "Landscape Topo": this.tile.osm_landscape,
            "Satalite": this.tile.mq_sat,
            "B&W Flat": this.tile.stamin_tonerlite,
        };
        var overLayMaps = {
            "Markers": markerList.mapGroup,
            "Rapids": rapidList.mapGroup,
            "Gauges": gaugeList.mapGroup,
            "Runs": runList.mapGroup
        };
        this.layersControl = new L.control.layers(baseMaps, overLayMaps, {position: 'topleft'}).addTo(map);
        this.$el.append('<button type="button" class="tools-show">Tools</button>');
        return this;
    },
    events: {
        'moveend map': 'move',
        'zoomend map': 'zoom',
        'locationfound map': 'on_geolocation',
        'locationerror map': 'on_geolocation_fail',
        'click .tools-show': 'show_tools',
    },
    /* https://github.com/LuizArmesto/backbone.leaflet/blob/master/src/backbone.leaflet.js#L357 */
    delegateEvents: function ( events ) {
        var context = 'delegateEvents' + this.cid;
        Backbone.View.prototype.delegateEvents.apply( this, arguments );
        // Do everything as 'backbone' do but bind to 'leaflet'.
        if ( !( events || ( events = _.result( this, 'events' ) ) ) ) {
            return this;
        }
        var featureCallback = function ( method ) {
            return function ( e ) {
                var origEvent = e[0];
                method( origEvent );
            };
        };
        this._leaflet_events = {};
        for ( var key in events ) {
            // Get the callback method.
            var method = events[key];
            if ( !_.isFunction( method ) ) {
                method = this[events[key]];
            }
            if ( !method ) {
                throw new Error( 'Method "' + events[key] + '" does not exist' );
            }
            var delegateEventSplitter = /^(\S+)\s*(.*)$/;
            var match = key.match( delegateEventSplitter ),
            eventName = match[1],
            selector = match[2];
            method = _.bind( method, this );

            // Now we bind events with apselector to eafletmap.
            if ( selector === 'map' || selector === 'layer' ) {
                if ( selector === 'layer' ) {
                    eventName = 'layer_' + eventName;
                    method = featureCallback( method );
                }
                map.on( eventName, method, context );
                // Save the callbacks references to use to undelegate the events.
                this._leaflet_events[eventName] = method;
            }
        }
        return this;
    },
    move: function(e) {
        this.fetch_map_items().update_loc_url();
        return this;
    },
    fetch_map_items: function() {
        var mapbounds = map.getBounds().pad(.1);
        var nw = mapbounds.getNorthWest();
        var se = mapbounds.getSouthEast();
        var options = {
            data: {
                'geo_lat__lte': nw.lat,
                'geo_lat__gte': se.lat,
                'geo_lng__lte': se.lng,
                'geo_lng__gte': nw.lng,
            },
            remove: false
        }
        if (this.markerRequest) {
            this.markerRequest.abort();
            this.rapidRequest.abort();
            this.gaugeRequest.abort();
        }
        this.markerRequest = markerList.fetch(options);
        this.rapidRequest = rapidList.fetch(options);
        this.gaugeRequest = gaugeList.fetch(options);
        // runList.fetch({});
        return this;
    },
    zoom: function(e) {
        this.fetch_map_items().zoom_layer_vis().update_loc_url();
        return this;
    },
    zoom_layer_vis: function() {
        if (map.getZoom() > 10) {
            markerList.mapGroup.addTo(map);
        } else {
            map.removeLayer(markerList.mapGroup);
        }
        if (map.getZoom() > 11) {
            rapidList.mapGroup.addTo(map);
        } else {
            map.removeLayer(rapidList.mapGroup);
        }
        return this;
    },
    update_loc_url: function() {
        center = map.getCenter();
        lat = Math.round(center.lat * 1000000) / 1000000;
        lng = Math.round(center.lng * 1000000) / 1000000;
        zoom = map.getZoom();
        app.navigate(lat + ',' + lng + ',' + zoom, {trigger: false, replace: false});
        return this;
    },
    on_geolocation: function(e) {
        L.circle(e.latlng, 10).addTo(map);
        return this;
    },
    on_geolocation_fail: function(e) {
        map.setView([47, -122], 14);
        return this;
    },
    show_tools: function() {
        $('.tools').addClass('in');
        return this;
    }
});
// modal window view
window.ModalView = Backbone.View.extend({
    className: "details",
    id: "modal",
    events: {
        "click .close": "close",
        "click .edit": "openEdit",
        "click .river": "openRiver",
        "click .cancel": "cancel",
        "submit #form": "submitForm"
    },
    initialize: function() {

    },
    render: function(action) {
        action = typeof action !== 'undefined' ? action : 'details';
        t = Handlebars.compile('<button type="button" class="close">&times;</button>' +
            this.model.template(action));
        this.$el.html(t(this.model.attributes));
        this.model.postRender();
        return this;
    },
    openEdit: function() {
        this.render('edit');
    },
    openRiver: function() {
        var model = riverList.find({id: this.get('river').id});
        app.switchView(new ModalView({model: model}));
    },
    close: function() {
        this.removeCallbacks();
        app.switchView(null);
        app.mapView.update_loc_url();
    },
    submitForm: function(e) {
        e.preventDefault();
        this.$('.submit').addClass('disabled');
        var form_json = this.$('form').serializeObject();
        this.$('.error').remove();
        var that = this;
        this.model.save(form_json, {patch: true, wait: true,
            url: this.model.url + this.model.get('id'),
            success: function(model, xhr) {
                console.log("success");
                that.removeCallbacks().render();
            },
            error: function(model, xhr) {
                if (xhr.statusText == "CREATED") {
                    console.log("created");
                    that.collection.add(model);
                    that.close();
                } else {
                    console.log("failure");
                    that.onFailure(model, xhr);
                }
            }
        });
        return this;
    },
    cancel: function(e) {
        e.preventDefault();
        this.removeCallbacks().render();
        return this;
    },
    removeCallbacks: function() {
        map.off('click');
        this.model.removeCallbacks();
        return this;
    },
    onFailure: function(model, xhr) {
        console.log("failure");
        console.log("response text: " + xhr.responseText);
        console.log("status: " + xhr.status);
        console.log("statusText: " + xhr.statusText);
        var error_message;
        switch (xhr.status) {
            case 401:
                error_message = "You are not allowed to do that. Are you logged in?";
                break;
            case 500:
                var json_error = JSON.parse(xhr.responseText).error_message;
                console.log(json_error)
                var error_code = json_error.match(/\d+/);
                switch (parseInt(error_code)) {
                    case 1062: // duplicate entry
                        error_message = json_error;
                        break;
                    default:
                        break;
                }
                break;
            default:
                error_message = "An error has occured.";
                break;
        }
        this.$('form').prepend('<p class="error">' + error_message + '</p>');
    },
});
window.RiverModalView = window.ModalView.extend({
    initialize:function() {
        t = Handlebars.compile('<button type="button" class="close">&times;</button>' +
            this.model.template());
        this.$el.html(t(this.model.attributes));
    },
    requests: {},
    render: function() {
        console.log("showing river");
        r_id = this.model.get('id');
        var r_a = this.model.attributes;
        console.log(this.model.attributes);
        console.log(this.model);
        // TODO consider using pluck on the collections to get some model attribute/function
        this.requests.markers = markerList.fetch({data: {river: r_id}, success: function(collection, response) {
            collection = collection.filter(function(item) {
                return item.get('river').id == r_id;
            });
            if (collection.length > 0) {
                var to_append = "<h4>Markers</h4><ul>";
                _.each(collection, function(marker) {
                    to_append += '<li><a href="#marker/' + marker.get('id') + '">' + marker.get('name') + ' ' + marker.get('marker_type').name + '</a></li>';
                });
                to_append += "</ul>";
                this.$('#markers').html(to_append);
            } else {
                this.$('#markers').empty();
            }
        }, remove: false});
        this.requests.gauges = gaugeList.fetch({data: {river: r_id}, success: function(collection, response) {
            collection = collection.filter(function(item) {
                return item.get('river').id == r_id;
            });
            if (collection.length > 0) {
                var to_append = "<h4>Gauges</h4><ul>";
                _.each(collection, function(gauge) {
                    to_append += '<li><a href="#gauge/' + gauge.get('id') + '">' + gauge.get('name') + '</a></li>';
                });
                to_append += "</ul>";
                this.$('#gauges').html(to_append);
            } else {
                this.$('#gauges').empty();
            }
        }, remove: false});
        this.requests.rapids = rapidList.fetch({data: {river: r_id}, success: function(collection, response) {
            collection = collection.filter(function(item) {
                return item.get('river').id == r_id;
            });
            if (collection.length > 0) {
                var to_append = "<h4>Rapids</h4><ul>";
                _.each(collection, function(rapid) {
                    to_append += '<li><a href="#rapid/' + rapid.get('id') + '">' + rapid.get('name') + ' - Class ' + ratings[rapid.get('rating')] + '</a></li>';
                });
                to_append += "</ul>";
                this.$('#rapids').html(to_append);
            } else {
                this.$('#rapids').empty();
            }
        }, remove: false});
        this.requests.runs = runList.fetch({data: {river: r_id}, success: function(collection, response) {
            collection = collection.filter(function(item) {
                return item.get('river').id == r_id;
            });
            if (collection.length > 0) {
                var to_append = "<h4>Runs</h4><ul>";
                _.each(collection, function(run) {
                    to_append += '<li><a href="#run/' + run.get('id') + '">';
                    if (run.get('name') != "") {
                        to_append += run.get('name');
                    } else {
                        to_append += this.model.get('name');
                    }
                    to_append += '</a></li>';
                }, this);
                to_append += "</ul>";
                this.$('#runs').html(to_append);
            } else {
                this.$('#runs').empty();
            }
        }, remove: false});
    },
    removeCallbacks: function() {
        for (request in this.requests) {
            if (request) {
                request.abort();
            }
        }
        return this;
    },
});
window.LoginView = window.ModalView.extend({
    template: '<h3>Login</h3>' +
        '<form id="form">' +
            '<label for="id_username">Username</label>' +
            '<input type="text" name="username" id="id_username" required>' +
            '<label for="id_password">Password</label>' +
            '<input type="password" name="password" id="id_password" required>' +
            '<input type="submit" class="btn btn-primary" value="Go!">' +
        '</form>',
    initialize: function() {
        t = '<button type="button" class="close">&times;</button>' + this.template;
        this.$el.html(t);
        return this;
    },
    submitForm: function(e) {
        e.preventDefault();
        var that = this;
        this.$('.error').remove();
        var form_json = this.$('form').serializeObject();
        $.ajaxSetup({
            headers: { "X-CSRFToken": app.getCookie("csrftoken") }
        });
        var post_login = $.post("login/", form_json);
        post_login.done(function(data) {
            that.$('.error').empty();
            if (data.valid) {
                console.log('logged in');
                that.close();
                app.toolsView.render();
            } else {
                that.$('form').prepend('<p class="error">' + data.error + '</p>');
            }
        });
    }
});
window.AddView = window.ModalView.extend({
    initialize: function() {
        t = '<button type="button" class="close">&times;</button>' +
            '<form id="form">' + this.collection.addTemplate(this) +
            '<button type="submit" class="btn btn-primary">Submit</button></form>';
        this.$el.html(t);
        this.collection.postRenderAdd(this);
        return this;
    },
    name: '<label name="name">Name</label><input type="text" name="name" />',
    description: '<label name="description">Description</label><textarea name="description"></textarea>',
    selectRivers: function() {
        var return_val = '<label name="river">River</label><select name="river">';
        riverList.forEach(function(element, index, array) {
            return_val += '<option value="' + element.get('id') + '">';
            return_val += element.get('name');
            return_val += '</option>';
        });
        return_val += '</select>';
        return return_val;
    },
    centerMarker: null,
    latLngPicker: function() {
        var return_val = '<label name="geo_lat">Latitude</label>' +
            '<input type="number" name="geo_lat" id="lat" class="lat" min="-90" max="90" step=".0000000001" required>' +
            '<label name="geo_lng">Longitude</label>' +
            '<input type="number" name="geo_lng" id="lng" class="lng" min="-180" max="180" step=".0000000001" required>' +
            '<span class="help-block">Click on the map to choose a location.</span>';
        var that = this;
        if (!this.centerMarker) {
            this.mapGroup = new L.layerGroup().addTo(map);
            this.centerMarker = new L.marker(map.getCenter(), {draggable: true, riseOnHover: true}).addTo(map);
            this.mapGroup.addLayer(this.centerMarker);
        }
        this.centerMarker.on('move', function(e) {
            that.latVal = Math.round(e.latlng.lat * Math.pow(10, 10)) / Math.pow(10, 10);
            that.lngVal = Math.round(e.latlng.lng * Math.pow(10, 10)) / Math.pow(10, 10);
            $("#lat").val(that.latVal);
            $("#lng").val(that.lngVal);
        });
        map.on('click', function(e) {
            that.latVal = e.latlng.lat;
            that.lngVal = e.latlng.lng;
            that.centerMarker.setLatLng([that.latVal, that.lngVal]);
        });
        return return_val;
    },
    submitForm: function(e) {
        e.preventDefault();
        var form_json = this.$('form').serializeObject();
        this.$('.error').remove();
        var that = this;
        this.collection.create(form_json, {
            success: function(model, xhr) {
                console.log("success");
                that.close();
            },
            error: function(model, xhr) {
                if (xhr.statusText == "CREATED") {
                    console.log("created");
                    that.collection.add(model);
                    that.close();
                } else {
                    that.onFailure(model, xhr);
                }
            },
            wait: true // not tested
        });
    },
    onFailure: function(model, xhr) {
        console.log("failure");
        console.log("response text: " + xhr.responseText);
        console.log("status: " + xhr.status);
        console.log("statusText: " + xhr.statusText);
        var error_message;
        switch (xhr.status) {
            case 401:
                error_message = "You are not allowed to do that. Are you logged in?";
                break;
            case 500:
                var json_error = JSON.parse(xhr.responseText).error_message;
                console.log(json_error)
                var error_code = json_error.match(/\d+/);
                switch (parseInt(error_code)) {
                    case 1062: // duplicate entry
                        error_message = json_error;
                        break;
                    default:
                        error_message = json_error;
                        break;
                }
                break;
            default:
                error_message = "An error has occured.";
                break;
        }
        this.$('form').prepend('<p class="error">' + error_message + '</p>');
    },
    remove: function() {
        if (typeof this.mapGroup != 'undefined') {
            this.mapGroup.clearLayers();
        }
        this.$el.remove();
        this.stopListening();
        return this;
    }
});
window.ToolsView = Backbone.View.extend({
    el: ".tools .nav",
    initialize: function() {
        var that = this;
        $.get('/tools', function(data) {
            that.$el.html(data);
        }, 'html');
    },
    render: function() {
    },
    events: {
        "click .hide": "close",
        "click .marker": "marker",
        "click .markertype": "markertype",
        "click .rapid": "rapid",
        "click .run": "run",
        "click .gauge": "gauge",
        "click .river": "river",
        "click .login": "login",
        "click .account": "account",
    },
    close: function() {
        $('.tools').removeClass('in');
    },
    marker: function() {
        app.switchView(new AddView({collection: markerList}));
    },
    markertype: function() {
        app.switchView(new AddView({collection: markerTypeList}));
    },
    rapid: function() {
        app.switchView(new AddView({collection: rapidList}));
    },
    run: function() {
        app.switchView(new AddView({collection: runList}));
    },
    gauge: function() {
        app.switchView(new AddView({collection: gaugeList}));
    },
    river: function() {
        app.switchView(new AddView({collection: riverList}));
    },
    login: function() {
        app.switchView(new LoginView());
    },
    account: function() {
        alert('This is not implemented yet');
    },
});

/**
 * Router
 */
var AppRouter = Backbone.Router.extend({
    initialize: function(el) {
        this.el = el
        this.toolsView = new ToolsView();
        this.mapView = new MapView();

        _.bindAll(this, 'on_keypress');
        $(document).bind('keyup', this.on_keypress);
    },
    on_keypress: function(e) {
        switch (e.keyCode) {
            case 27:
                this.switchView(null);
                break;
        }
    },
    currentView: null,
    switchView: function(view) {
        this.el.addClass('in');
        if (this.currentView) {
            // Detach the old view
            this.currentView.remove();
        }
        if (view) {
            // move the view element into the DOM (replacing the  old content)
            this.el.html(view.el);
            // render view after it is in the DOM (styles are applied)
            view.render();
        } else {
            this.el.removeClass('in');
        }
        this.currentView = view;
    },
    routes: {
        "": "index",
        ":lat,:lng,:zoom": "loc",
        "marker/:id": "marker",
        "rapid/:id": "rapid",
        "gauge/:id": "gauge",
        "run/:id": "run",
        "river/:id": "river",
    },
    index: function() {
        map.locate({setView: true, maxZoom: 14});
    },
    loc: function(lat, lng, zoom) {
        map.setView([lat, lng], zoom);
        map.off('locationerror');
    },
    marker: function(id) {
        this.map_marker(markerList, Marker, id);
    },
    rapid: function(id) {
        this.map_marker(rapidList, Rapid, id);
    },
    gauge: function(id) {
        this.map_marker(gaugeList, Gauge, id);
    },
    run: function(id) {
        var id = parseInt(id);
        var model = runList.findWhere({id: id});
        if (!model) {
            var that = this;
            runList.fetch({data: {id: id}, remove: false, success: function(mr, response) {
                model = new Run(response.objects[0]);
                map.fitBounds(model.mapItem.getBounds());
                this.switchView(new ModalView({model: model}));
            }});
        } else {
            map.fitBounds(model.mapItem.getBounds());
            this.switchView(new ModalView({model: model}));
        }
    },
    river: function(id) {
        var id = parseInt(id);
        var model = riverList.findWhere({id: id});
        if (!model) {
            map.locate({setView: true, maxZoom: 14});
            var that = this;
            riverList.fetch({data: {id: id}, success: function(mr, response) {
                model = new River(response.objects[0]);
                that.switchView(new RiverModalView({model: model}));
            }, remove: false});
        } else {
            this.switchView(new RiverModalView({model: model}));
        }
    },
    map_marker: function(collection, modelType, id) {
        var id = parseInt(id);
        var model = collection.findWhere({id: id});
        if (!model) {
            var that = this;
            collection.fetch({data: {id: id}, success: function(mr, response) {
                model = new modelType(response.objects[0]);
                map.setView([model.get('geo_lat'), model.get('geo_lng')], 14);
                that.switchView(new ModalView({model: model}));
            }, remove: false});
        } else {
            map.setView([model.get('geo_lat'), model.get('geo_lng')], 14);
            this.switchView(new ModalView({model: model}));
        }
    },
    getCookie: function(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    },
    switchDetailView: function(newView) {
        console.log(this.detailView);
        this.detailView = newView;
    },
});

var markerList = new MarkerCollection,
    rapidList = new RapidCollection,
    gaugeList = new GaugeCollection,
    runList = new RunCollection,
    markerTypeList = new MarkerTypeCollection,
    riverList = new RiverCollection;

var app = new AppRouter($('#content'));
Backbone.history.start();
