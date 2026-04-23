<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('sessions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('role', ['session_admin', 'signatory', 'viewer', 'session_editor'])->default('signatory');
            $table->string('display_role_name')->nullable();
            $table->unsignedInteger('sign_order')->nullable();
            $table->enum('member_status', ['waiting', 'pending', 'signed', 'viewed'])->default('waiting');
            $table->boolean('can_view_session')->default(true);
            $table->boolean('can_view_document')->default(true);
            $table->boolean('can_sign')->default(false);
            $table->boolean('can_view_drive_panel')->default(false);
            $table->boolean('can_add_files')->default(false);
            $table->boolean('can_remove_files')->default(false);
            $table->boolean('can_edit_session')->default(false);
            $table->boolean('can_manage_signatories')->default(false);
            $table->boolean('can_send_notifications')->default(false);
            $table->boolean('can_close_session')->default(false);
            $table->timestamp('signed_at')->nullable();
            $table->timestamps();

            $table->unique(['session_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('session_members');
    }
};
