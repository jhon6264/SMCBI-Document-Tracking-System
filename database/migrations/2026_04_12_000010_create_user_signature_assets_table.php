<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_signature_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('type', ['uploaded', 'drawn']);
            $table->string('original_path');
            $table->string('processed_path')->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->boolean('is_active')->default(false);
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_signature_assets');
    }
};
