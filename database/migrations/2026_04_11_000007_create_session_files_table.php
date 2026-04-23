<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('sessions')->cascadeOnDelete();
            $table->string('google_drive_file_id')->nullable();
            $table->string('google_drive_parent_id')->nullable();
            $table->string('name');
            $table->string('mime_type', 120)->nullable();
            $table->string('web_view_link')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('source', ['drive', 'docs', 'upload'])->default('drive');
            $table->boolean('is_primary_document')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('session_files');
    }
};
