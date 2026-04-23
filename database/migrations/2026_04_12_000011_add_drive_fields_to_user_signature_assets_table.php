<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            Schema::hasColumn('user_signature_assets', 'drive_file_id')
            && Schema::hasColumn('user_signature_assets', 'drive_web_view_link')
            && Schema::hasColumn('user_signature_assets', 'drive_public_url')
        ) {
            return;
        }

        Schema::table('user_signature_assets', function (Blueprint $table) {
            if (!Schema::hasColumn('user_signature_assets', 'drive_file_id')) {
                $table->string('drive_file_id')->nullable()->after('processed_path');
            }

            if (!Schema::hasColumn('user_signature_assets', 'drive_web_view_link')) {
                $table->string('drive_web_view_link')->nullable()->after('drive_file_id');
            }

            if (!Schema::hasColumn('user_signature_assets', 'drive_public_url')) {
                $table->string('drive_public_url')->nullable()->after('drive_web_view_link');
            }
        });
    }

    public function down(): void
    {
        if (
            !Schema::hasColumn('user_signature_assets', 'drive_file_id')
            && !Schema::hasColumn('user_signature_assets', 'drive_web_view_link')
            && !Schema::hasColumn('user_signature_assets', 'drive_public_url')
        ) {
            return;
        }

        Schema::table('user_signature_assets', function (Blueprint $table) {
            $columns = [];

            if (Schema::hasColumn('user_signature_assets', 'drive_file_id')) {
                $columns[] = 'drive_file_id';
            }

            if (Schema::hasColumn('user_signature_assets', 'drive_web_view_link')) {
                $columns[] = 'drive_web_view_link';
            }

            if (Schema::hasColumn('user_signature_assets', 'drive_public_url')) {
                $columns[] = 'drive_public_url';
            }

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
