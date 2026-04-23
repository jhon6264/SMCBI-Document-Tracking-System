<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Tracking System</title>
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
</head>
<body>
    <div id="app"></div>

    <script>
        window.appConfig = {
            googleClientId: "{{ config('services.google.client_id') }}",
            googleRedirectUri: "{{ config('services.google.redirect') }}",
            institutionDomain: "smcbi.edu.ph"
        };
    </script>
    <script src="{{ asset('js/app.js') }}"></script>
</body>
</html>
