<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/admin/{path?}', function () {
    return view('welcome');
})->where('path', '.*');

Route::get('/user/{path?}', function () {
    return view('welcome');
})->where('path', '.*');
