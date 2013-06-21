from django.contrib.auth.models import User
from tastypie.resources import ModelResource, ALL, ALL_WITH_RELATIONS
from tastypie import fields
from tastypie.authentication import SessionAuthentication, Authentication
from tastypie.authorization import DjangoAuthorization, Authorization
from tastypie.cache import NoCache
from django.core.cache import cache
from rivers.models import River, MarkerType, Gauge, Marker, Rapid, Run
import json
import rivers.settings

class CustomCache(NoCache):
    def _load(self):
        data_file = open(settings.CACHES['default']['LOCATION'] + '_' + self.id, 'r')
        return json.load(data_file)

    def _save(self):
        data_file = open(settings.CACHES['default']['LOCATION'] + '_' + self.id, 'w')
        return json.dump(data_file)

    def get(self, key):
        data = self._load()
        return data.get(key, None)

    def set(self, key, value, timeout=900):
        data = self._load()
        data[key] = value
        self._save(data)

class CustomAuthentication(SessionAuthentication):
    def is_authenticated(self, request, **kwargs):
        return super(SessionAuthentication, self).is_authenticated(request, **kwargs)

class CustomAuthorization(DjangoAuthorization):
    def is_authorized(self, request, object=None):
        if request.method == 'GET':
            return True
        return super(CustomAuthorization, self).is_authorized(request, object)

class UserResource(ModelResource):
    class Meta:
        queryset = User.objects.all()
        excludes = ['email', 'password', 'is_active', 'is_staff', 'is_superuser']
        allowed_methods = ['get']
        authentication = CustomAuthentication()

class RiverResource(ModelResource):
    class Meta:
        queryset = River.objects.all()
        authentication = CustomAuthentication()
        authorization = DjangoAuthorization()
        filtering = {
            'id': ALL,
        }

class MarkerTypeResource(ModelResource):
    class Meta:
        queryset = MarkerType.objects.all()
        allowed_methods = ['get', 'put', 'post']
        authentication = CustomAuthentication()
        authorization = DjangoAuthorization()

class GaugeResource(ModelResource):
    river = fields.ToOneField(RiverResource, 'river', full=True)

    def hydrate_river(self, bundle):
        bundle.data['river'] = River.objects.get(id=bundle.data['river'])
        return bundle

    def dehydrate(self, bundle):
        import urllib2, time, datetime, re
        if bundle.data['gauge_type'] == "USGS":
            url = "http://waterservices.usgs.gov/nwis/iv/?sites=" + bundle.data['gauge_id'] + "&period=P7D&format=json"
            request = urllib2.Request(url)
            try:
                    response = urllib2.urlopen(request)
            except urllib2.HTTPError, e:
                    return bundle
            except urllib2.URLError, e:
                    return bundle
            except httplib.HTTPException, e:
                    return bundle
            except Exception:
                    import traceback
                    return bundle
            gauge_json = json.load(response)

            bundle.data['link'] = "http://waterdata.usgs.gov/usa/nwis/uv?" + bundle.data['gauge_id'];
            bundle.data['data'] = {}
            count = 0
            for item in gauge_json['value']['timeSeries']:
                if item['sourceInfo']['siteName'] is not None:
                    bundle.data['name'] = str(item['sourceInfo']['siteName']).title()
                bundle.data['geo_lat'] = float(item['sourceInfo']['geoLocation']['geogLocation']['latitude'])
                bundle.data['geo_lng'] = float(item['sourceInfo']['geoLocation']['geogLocation']['longitude'])

                bundle.data['data'][count] = {
                        'unit': item['variable']['unit']['unitAbbreviation'],
                        'unitName': item['variable']['variableName'],
                        'unitDesc': item['variable']['variableDescription'],
                        'recent': float(item['values'][0]['value'][-1]['value']),
                        'trend': float(item['values'][0]['value'][-1]['value']) - float(item['values'][0]['value'][-13]['value']),
                        'values': []
                    }
                for item_val in item['values'][0]['value']:
                    # convert usgs time to epoch time, then multiply by 1000 to get highcharts milliseconds time
                    timestamp = time.mktime(datetime.datetime.strptime(item_val['dateTime'], "%Y-%m-%dT%H:%M:%S.%f-07:00").timetuple()) * 1000
                    bundle.data['data'][count]['values'].append([
                            timestamp, float(item_val['value'])
                        ])
                count += 1
        elif bundle.data['gauge_type'] == "WADOE":
            url = "https://fortress.wa.gov/ecy/wrx/wrx/flows/stafiles/" + bundle.data['gauge_id'] + "/" + bundle.data['gauge_id'] + "_DSG_FM.txt"
            request = urllib2.Request(url)
            try:
                    response = urllib2.urlopen(request)
            except urllib2.HTTPError, e:
                    return bundle
            except urllib2.URLError, e:
                    return bundle
            except httplib.HTTPException, e:
                    return bundle
            except Exception:
                    import traceback
                    return bundle
            gauge_data = response.read()

            bundle.data['link'] = "https://fortress.wa.gov/ecy/wrx/wrx/flows/station.asp?sta=" + bundle.data['gauge_id']
            name = re.findall(bundle.data['gauge_id'] + '--(.*?)\r\n', gauge_data)
            bundle.data['name'] = name[0]
            gauge_data = gauge_data[gauge_data.find('DATE'):]
            bundle.data['data'] = {}
            bundle.data['data'][0] = {
                    'unit': 'cfs',
                    'unitName': 'Streamflow, ft&#179;/s',
                    'unitDesc': "Discharge, cubic feet per second",
                    'values': []
                }
            count = -2
            one_week = datetime.datetime.now() - datetime.timedelta(weeks=1)
            for line in re.findall('.*?\n', gauge_data):
                if count >= 0:
                    if (re.compile("\d\d/\d\d/\d\d").match(line)):
                        timestamp = datetime.datetime.strptime(line[0:18], "%m/%d/%Y   %H:%M")
                        if timestamp > one_week:
                            timestamp = time.mktime(timestamp.timetuple()) * 1000
                            val = re.findall("[\d|.]+", line[19:])
                            if len(val) > 0:
                                bundle.data['data'][0]['values'].append([
                                         timestamp, float(val[0])
                                    ])
                else:
                    count += 1
            bundle.data['data'][0]['recent'] = bundle.data['data'][0]['values'][-1][1]
            bundle.data['data'][0]['trend'] = bundle.data['data'][0]['values'][-1][1] - bundle.data['data'][0]['values'][-1 - (4 * 3)][1]
        else:
            bundle.data['data'] = False
        return bundle

    class Meta:
        queryset = Gauge.objects.all()
        allowed_methods = ['get', 'post']
        authentication = CustomAuthentication()
        authorization = DjangoAuthorization()
        filtering = {
            'river': ALL_WITH_RELATIONS,
            'gauge_id': ALL,
            'geo_lat': ALL,
            'geo_lng': ALL,
            'id': ALL,
        }
        cache = CustomCache()

class MarkerResource(ModelResource):
    river = fields.ToOneField(RiverResource, 'river', full=True)
    pub_user = fields.ToOneField(UserResource, 'pub_user', full=True)
    marker_type = fields.ToOneField(MarkerTypeResource, 'marker_type', full=True)

    def hydrate_river(self, bundle):
        bundle.data['river'] = River.objects.get(id=int(bundle.data['river']))
        return bundle

    def hydrate_pub_user(self, bundle):
        if not hasattr(bundle.obj, 'pub_user'):
            bundle.obj.pub_user = User.objects.get(pk = bundle.request.user.id)
        return bundle

    def hydrate_marker_type(self, bundle):
        bundle.data['marker_type'] = MarkerType.objects.get(id=int(bundle.data['marker_type']))
        return bundle

    class Meta:
        queryset = Marker.objects.all()
        always_return_data = True
        allowed_methods = ['get', 'put', 'post', 'patch', 'delete']
        authentication = CustomAuthentication()
        authorization = DjangoAuthorization()
        filtering = {
            'river': ALL_WITH_RELATIONS,
            'geo_lat': ALL,
            'geo_lng': ALL,
            'id': ALL,
        }

class RapidResource(ModelResource):
    river = fields.ForeignKey(RiverResource, 'river', full=True)
    pub_user = fields.ToOneField(UserResource, 'pub_user', full=True)

    def hydrate_river(self, bundle):
        bundle.data['river'] = River.objects.get(id=bundle.data['river'])
        return bundle

    def hydrate_pub_user(self, bundle):
        bundle.obj.pub_user = User.objects.get(pk = bundle.request.user.id)
        return bundle

    class Meta:
        queryset = Rapid.objects.all()
        authentication = CustomAuthentication()
        authorization = DjangoAuthorization()
        filtering = {
            'river': ALL_WITH_RELATIONS,
            'rating': ALL,
            'geo_lat': ALL,
            'geo_lng': ALL,
            'id': ALL,
        }

class RunResource(ModelResource):
    river = fields.ToOneField(RiverResource, 'river', full=True)
    pub_user = fields.ToOneField(UserResource, 'pub_user', full=True)
    gauge = fields.ToOneField(GaugeResource, 'gauge', full=False)

    def hydrate_river(self, bundle):
        bundle.data['river'] = River.objects.get(id=bundle.data['river'])
        return bundle

    def hydrate_gauge(self, bundle):
        bundle.data['gauge'] = Gauge.objects.get(id=bundle.data['gauge'])
        return bundle

    def hydrate_pub_user(self, bundle):
        if not hasattr(bundle.obj, 'pub_user'):
            bundle.obj.pub_user = User.objects.get(pk = bundle.request.user.id)
        return bundle

    class Meta:
        queryset = Run.objects.all()
        authentication = CustomAuthentication()
        authorization = DjangoAuthorization()
        filtering = {
            'river': ALL_WITH_RELATIONS,
            'id': ALL,
        }
