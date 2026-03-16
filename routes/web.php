<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/admin/dashboard', function () {
    return view('welcome');
});

Route::get('/admin/admin-management', function () {
    return view('welcome');
});

Route::get('/admin/user-management', function () {
    return view('welcome');
});