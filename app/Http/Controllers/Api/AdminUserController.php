<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AdminUserController extends Controller
{
    private array $allowedRoles = [
        'Faculty',
        'Staff',
        'Instructor',
        'Cashier',
        'Registrar',
        'President',
    ];

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'department' => $user->department?->name,
            'department_id' => $user->department_id,
            'status' => $user->status,
            'google_id' => $user->google_id,
            'created_at' => $user->created_at,
        ];
    }

    public function getDepartments()
    {
        $departments = Department::orderBy('name')->get();

        return response()->json([
            'success' => true,
            'departments' => $departments,
        ], 200);
    }

    public function getUsers()
    {
        $users = User::with('department')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($user) {
                return $this->formatUser($user);
            });

        return response()->json([
            'success' => true,
            'users' => $users,
        ], 200);
    }

    public function storeUser(Request $request)
    {
        $validator = Validator::make(
            $request->all(),
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => [
                    'required',
                    'string',
                    'max:255',
                    'email',
                    'unique:users,email',
                    'regex:/^[A-Za-z0-9._%+-]+@smcbi\.edu\.ph$/',
                ],
                'role' => ['required', Rule::in($this->allowedRoles)],
                'department_id' => ['required', 'exists:departments,id'],
                'status' => ['required', 'in:Active,Inactive'],
            ],
            [
                'email.unique' => 'This institutional email is already registered.',
                'email.regex' => 'Email must be a valid @smcbi.edu.ph address.',
                'role.in' => 'Selected role is invalid.',
            ]
        );

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = User::create([
            'name' => trim($request->name),
            'email' => strtolower(trim($request->email)),
            'role' => $request->role,
            'department_id' => $request->department_id,
            'status' => $request->status,
            'google_id' => null,
        ]);

        $user->load('department');

        return response()->json([
            'success' => true,
            'message' => 'User added successfully.',
            'user' => $this->formatUser($user),
        ], 201);
    }

    public function updateUser(Request $request, $id)
    {
        $user = User::with('department')->find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $validator = Validator::make(
            $request->all(),
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => [
                    'required',
                    'string',
                    'max:255',
                    'email',
                    Rule::unique('users', 'email')->ignore($user->id),
                    'regex:/^[A-Za-z0-9._%+-]+@smcbi\.edu\.ph$/',
                ],
                'role' => ['required', Rule::in($this->allowedRoles)],
                'department_id' => ['required', 'exists:departments,id'],
                'status' => ['required', 'in:Active,Inactive'],
            ],
            [
                'email.unique' => 'This institutional email is already registered.',
                'email.regex' => 'Email must be a valid @smcbi.edu.ph address.',
                'role.in' => 'Selected role is invalid.',
            ]
        );

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user->update([
            'name' => trim($request->name),
            'email' => strtolower(trim($request->email)),
            'role' => $request->role,
            'department_id' => $request->department_id,
            'status' => $request->status,
        ]);

        $user->load('department');

        return response()->json([
            'success' => true,
            'message' => 'User updated successfully.',
            'user' => $this->formatUser($user),
        ], 200);
    }

    public function toggleUserStatus($id)
    {
        $user = User::with('department')->find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $user->status = $user->status === 'Active' ? 'Inactive' : 'Active';
        $user->save();
        $user->load('department');

        return response()->json([
            'success' => true,
            'message' => $user->status === 'Active'
                ? 'User activated successfully.'
                : 'User disabled successfully.',
            'user' => $this->formatUser($user),
        ], 200);
    }

    public function deleteUser($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'User deleted successfully.',
        ], 200);
    }
}