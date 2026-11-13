from __future__ import annotations

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import UserQuery
from .serializers import UserQuerySerializer


class UserQueryCreateView(generics.CreateAPIView):
    serializer_class = UserQuerySerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, status=UserQuery.Status.OPEN)
