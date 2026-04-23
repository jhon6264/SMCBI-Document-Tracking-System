<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('session_files', function (Blueprint $table) {
            $table->string('source_google_drive_file_id')->nullable()->after('session_id');
            $table->string('source_mime_type', 120)->nullable()->after('google_drive_file_id');
            $table->boolean('is_converted_for_signing')->default(false)->after('source');
        });
    }

    public function down(): void
    {
        Schema::table('session_files', function (Blueprint $table) {
            $table->dropColumn([
                'source_google_drive_file_id',
                'source_mime_type',
                'is_converted_for_signing',
            ]);
        });
    }
};
