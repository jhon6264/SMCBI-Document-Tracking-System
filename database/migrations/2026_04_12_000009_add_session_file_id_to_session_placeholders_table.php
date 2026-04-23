<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('session_placeholders', function (Blueprint $table) {
            $table->foreignId('session_file_id')
                ->nullable()
                ->after('session_id')
                ->constrained('session_files')
                ->nullOnDelete();

            $table->index(['session_id', 'session_file_id'], 'session_placeholders_session_file_idx');
        });

        $primaryFiles = DB::table('session_files')
            ->select('id', 'session_id')
            ->where('is_primary_document', true)
            ->get()
            ->keyBy('session_id');

        DB::table('session_placeholders')
            ->select('id', 'session_id')
            ->orderBy('id')
            ->chunkById(200, function ($placeholders) use ($primaryFiles) {
                foreach ($placeholders as $placeholder) {
                    $primaryFile = $primaryFiles->get($placeholder->session_id);
                    if (!$primaryFile) {
                        continue;
                    }

                    DB::table('session_placeholders')
                        ->where('id', $placeholder->id)
                        ->update(['session_file_id' => $primaryFile->id]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('session_placeholders', function (Blueprint $table) {
            $table->dropIndex('session_placeholders_session_file_idx');
            $table->dropConstrainedForeignId('session_file_id');
        });
    }
};
