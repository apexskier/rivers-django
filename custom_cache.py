from django.core.cache import cache

class CustomCache(object):

    def __init__(self, varies=None, *args, **kwargs):
        super(CustomCache, self).__init__(*args, **kwargs)
        self.varies = varies

        if self.varies is None:
            self.varies = ["Accept"]

    def get(self, key):
        return None

    def set(self, key, value, timeout=60):
        pass

    def cacheable(self, request, response):
        return bool(request.method == "GET" and response.status_code == 200)

    def cache_control(self):
        return {
            'no_cache': True,
        }

