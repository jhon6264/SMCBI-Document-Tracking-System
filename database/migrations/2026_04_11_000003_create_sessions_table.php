<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sessions', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('document_type')->nullable();
            $table->enum('status', ['draft', 'active', 'completed', 'closed', 'overdue'])->default('draft');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('google_doc_file_id')->nullable();
            $table->string('google_drive_folder_id')->nullable();
            $table->timestamp('deadline_at')->nullable();
            $table->boolean('allow_delegated_editing')->default(false);
            $table->longText('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
    }
};
