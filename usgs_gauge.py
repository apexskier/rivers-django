import urllib2
import json

response = urllib2.urlopen('http://waterservices.usgs.gov/nwis/iv/?sites=' + this.id + '&period=P7D&format=json')
response_data = response.read()

return HttpResponse(json.dumps(response_data), content_type="application/json")
