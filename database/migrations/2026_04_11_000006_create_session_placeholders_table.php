<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_placeholders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('sessions')->cascadeOnDelete();
            $table->foreignId('registry_placeholder_id')->nullable()->constrained('signatory_placeholders')->nullOnDelete();
            $table->string('placeholder_key');
            $table->string('raw_token');
            $table->string('label')->nullable();
            $table->foreignId('assigned_member_id')->nullable()->constrained('session_members')->nullOnDelete();
            $table->enum('status', ['unassigned', 'assigned', 'signed'])->default('unassigned');
            $table->foreignId('signed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('signature_asset_id')->nullable()->constrained('signature_assets')->nullOnDelete();
            $table->timestamp('signed_at')->nullable();
            $table->timestamps();

            $table->index(['session_id', 'placeholder_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('session_placeholders');
    }
};
