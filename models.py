from django.db import models
from django.contrib.auth.models import User
import datetime

ZERO = 0
ONE = 1
ONEPLUS = 2
TWO = 3
TWOPLUS = 4
THREE = 5
THREEPLUS = 6
FOUR = 7
FOURPLUS = 8
FIVE = 9
FIVEPLUS = 10
SIX = 11
RATING_CHOICES = (
    (ZERO,      '-'),
    (ONE,       'I'),
    (ONEPLUS,   'I+'),
    (TWO,       'II'),
    (TWOPLUS,   'II+'),
    (THREE,     'III'),
    (THREEPLUS, 'III+'),
    (FOUR,      'IV'),
    (FOURPLUS,  'IV+'),
    (FIVE,      'V'),
    (FIVEPLUS,  'V+'),
    (SIX,       'Unrunnable'),
)

class River(models.Model):
    name = models.CharField(max_length=200, unique=True)

    def __unicode__(self):
        return self.name

class MarkerType(models.Model):
    name = models.CharField(max_length=200, unique=True)

    def __unicode__(self):
        return self.name

class Gauge(models.Model):
    gauge_id = models.CharField(max_length=10)
    GAUGE_TYPE_CHOICES = (
        ('USGS', 'United States Geological Survey (USGS)'),
        ('WADOE', 'Washington State Department of Ecology (fortress.wa.gov)'),
    )
    gauge_type = models.CharField(max_length=5, choices=GAUGE_TYPE_CHOICES)
    river = models.ForeignKey(River, blank=True, null=True)
    pub_date = models.DateTimeField('date created', auto_now_add=True)
    geo_lat = models.DecimalField('latitude', max_digits=13, decimal_places=10, blank=True, null=True, unique=True)
    geo_lng = models.DecimalField('longitude', max_digits=13, decimal_places=10, blank=True, null=True, unique=True)
    FLOW_UNITS_CHOICES = (
        ('ft3/s', 'cfs'),
        ('ft',  'feet'),
        ('m',   'meters'),
    )
    flow_units = models.CharField(max_length=8, choices=FLOW_UNITS_CHOICES)

    def __unicode__(self):
        return str(self.river) + ' ' + self.gauge_id

class RiverObjectCommon(models.Model):
    name = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    river = models.ForeignKey(River, null=True, blank=True)
    pub_date = models.DateTimeField('date created', auto_now_add=True)
    upd_date = models.DateTimeField('date updated', auto_now=True)
    pub_user = models.ForeignKey(User)

    def __unicode__(self):
        return self.name

    class Meta:
        abstract = True

class Marker(RiverObjectCommon):
    marker_type = models.ForeignKey(MarkerType)
    geo_lat = models.DecimalField('latitude', max_digits=13, decimal_places=10, unique=True)
    geo_lng = models.DecimalField('longitude', max_digits=13, decimal_places=10, unique=True)

class Rapid(RiverObjectCommon):
    rating = models.IntegerField(choices=RATING_CHOICES,default=ZERO)
    geo_lat = models.DecimalField('latitude', max_digits=13, decimal_places=10, unique=True)
    geo_lng = models.DecimalField('longitude', max_digits=13, decimal_places=10, unique=True)

class Playspot(RiverObjectCommon):
    geo_lat = models.DecimalField('latitude', max_digits=13, decimal_places=10, unique=True)
    geo_lng = models.DecimalField('longitude', max_digits=13, decimal_places=10, unique=True)

class Run(RiverObjectCommon):
    gauge = models.ForeignKey(Gauge, null=True, blank=True)
    max_level = models.DecimalField('max_level', max_digits=10, decimal_places=3, blank=True, null=True)
    min_level = models.DecimalField('min_level', max_digits=10, decimal_places=3, blank=True, null=True)
    max_rating = models.IntegerField(choices=RATING_CHOICES, blank=True)
    min_rating = models.IntegerField(choices=RATING_CHOICES, blank=True)
    gpx_file = models.FileField(upload_to="gpx/")

"""
class Image(models.Model):
    robject = models.OneToOneField(RiverObjectCommon)
    img_file = FileField()

    def __unicode__(self):
        return self.robject.name
"""
