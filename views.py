from django.shortcuts import render, redirect, render_to_response
from django.contrib.auth import authenticate, login, logout
from django.core.context_processors import csrf
from rivers.models import River, Gauge
import urllib2
import json
from django.http import HttpResponse, HttpResponseBadRequest
import json

def index(request):
    c = {}
    c.update(csrf(request))
    return render(request, 'index.html')

def tools(request):
    return render(request, 'tools.html')

def login_view(request):
    valid = False
    error = ""
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(username=username, password=password)
        if user is not None:
            if user.is_active:
                login(request, user)
                valid = True;
            else:
                error = "That account is not active"
        else:
            error = "Your username or password is incorrect"
    else:
        error = "Only post is allowed here"
    return HttpResponse(json.dumps({ 'error' : error, 'valid' : valid }), mimetype='application/json')

def logout_view(request):
    logout(request)
    return redirect('index')
